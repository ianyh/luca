import * as converter from 'number-to-words';

import { BattleActionArgs, BattleData } from './gameData';
import { logger } from './logger';
import { Options } from './schemas/get_battle_init_data';
import {
  describeStatusAilment,
  describeStatusAilmentBundle,
  getStatusVerb,
} from './statusAilments';
import { LangType, toEuroFixed } from './util';

import * as _ from 'lodash';

export interface NamedArgs {
  damageFactor?: number;
  barrageNum?: number;
  atkType?: number;
  forceHit?: number;
  healHpFactor?: number;
  barterRate?: number;
  selfSaOptionsDuration?: number;
  ignoresAttackHit?: number;
  elements?: number[];
  critical?: number;
  criticalCoefficient?: number;
  minDamageFactor?: number;
  situationalRecalculateDamageHookType?: number;
  damageCalculateTypeByAbility?: number;
  ignoresReflection?: number;
  ignoresMirageAndMightyGuard?: number;
  ignoresStatusAilmentsBarrier?: number;
  burstAbility?: number[];

  atkExponentialFactor?: number;
  matkExponentialFactor?: number;

  /**
   * Single physical element.  The elements array is more flexible.
   */
  atkElement?: number;

  /**
   * Single magical element.  The elements array is more flexible.
   */
  matkElement?: number;

  /**
   * Healing factor.
   */
  factor?: number;

  /**
   * If true, then each hit is done against the same target.
   */
  isSameTarget?: number;

  statusAilmentsId?: number;

  /**
   * The duration member of the options object for statusAilmentsId.
   */
  statusAilmentsOptionsDuration?: number;

  /**
   * The value parameter to helpers.makeBoostObject
   */
  statusAilmentsBoostValue?: number;

  /**
   * The isAbsolute parameter to helpers.makeBoostObject
   */
  statusAilmentsBoostIsAbsolute?: number;

  /**
   * A status ailment ID or status ailment bundle ID (see
   * StatusAilmentsConfig.getBundle) for a status applied to self.
   */
  selfSaBundleId?: number;

  /**
   * A single status ailment ID for a status applied to self.
   */
  selfSaId?: number;

  optionalSelfSaId?: number;

  /**
   * The duration member of the options object for self status ailments.
   */
  saSelfOptionsDuration?: number;

  /**
   * Also called hasSelfSaAnimation.
   */
  selfSaAnimationFlag?: number;

  setSaId?: number[];
  setSaBundle?: number[];
  unsetSaId?: number[];
  unsetSaBundle?: number[];

  /**
   * Percentage for stat boosts.  These are martialled by action class code in
   * battle.js and merged with the boosts array of the status ailment
   * definition, which provides additional details (such as *which* stats are
   * boosted).
   */
  boostsRate?: number[];

  damageCalculateParamAdjust?: number;
  damageCalculateParamAdjustConf?: number[];

  wrappedAbilityId?: number;

  /**
   * For trance actions (burst soul breaks) and brave soul breaks, these
   * specify which UI panels are swapped out (I think).
   */
  spareReceptorIds?: number[];

  /**
   * For diagnostic/debugging purposes, we support tracking unknown arguments.
   */
  unknown?: { [id: number]: number };
}

export interface BattleActionDetails extends BattleActionArgs {
  formula?: 'Physical' | 'Magical' | 'Hybrid';

  formatEnlir: (battleData: BattleData, options: Options, args: NamedArgs) => string;
}

function formatEnlirAttack(battleData: BattleData, options: Options, args: NamedArgs): string {
  const target = battleData.targetRangeLookup[options.target_range];
  const count = _.upperFirst(converter.toWords(args.barrageNum || 1));
  const who = target === 'SELF' || target === 'SINGLE' ? 'single' : 'group';
  const range = args.atkType === battleData.conf.ATK_TYPE.INDIRECT ? 'ranged ' : '';
  const multiplier = toEuroFixed((args.damageFactor || 0) / 100);

  let desc;
  if (!args.barrageNum || args.barrageNum === 1) {
    desc = `${count} ${who} ${range}attack (${multiplier})`;
  } else {
    desc = `${count} ${who} ${range}attacks (${multiplier} each)`;
  }

  if (options.max_damage_threshold_type && +options.max_damage_threshold_type) {
    desc += ' capped at 99999';
  }

  if (args.forceHit) {
    desc += ', 100% hit rate';
  }
  if (args.critical) {
    desc += `, ${args.critical}% additional critical chance`;
  }

  if (options.status_ailments_id && options.status_ailments_id !== '0') {
    const statusId = +options.status_ailments_id;
    const status = describeStatusAilment(battleData, statusId);
    let statusName: string;
    if (!status) {
      logger.warn(`Unknown status ID ${statusId}`);
      statusName = `unknown status ${statusId}`;
    } else {
      statusName = status.description;
    }
    desc += `, causes ${statusName} (${options.status_ailments_factor}%)`;
  }

  return desc;
}

function formatEnlirHeal(battleData: BattleData, options: Options, args: NamedArgs): string {
  let result = 'Restores HP';

  if (args.factor) {
    result += ` (${args.factor})`;
  }

  // Hack: Enlir displays "damages undeads" for abilities and burst commands
  // but not soul breaks.  We don't have direct access to whether these options
  // plus args are an ability or soul break, but checking whether it can be
  // countered seems to be a reliable indication.
  if (options.counter_enable && +options.counter_enable) {
    result += ', damages undeads';
  }

  return result;
}

function formatSelfStatus(battleData: BattleData, args: NamedArgs): string {
  const statusId = args.selfSaId as number;
  const status = describeStatusAilment(battleData, statusId);
  if (!status) {
    logger.warn(`Unknown status ID ${statusId}`);
    return 'grants unknown status to the user';
  } else {
    return `${getStatusVerb(status)}${status.description} to the user`;
  }
}

function formatStatuses(
  battleData: BattleData,
  statusAilmentIds?: number[],
  bundleIds?: number[],
): string {
  return _.filter(
    _.flatten([
      (statusAilmentIds || []).map(i => _.get(describeStatusAilment(battleData, i), 'description')),
      (bundleIds || []).map(i => _.get(describeStatusAilmentBundle(battleData, i), 'description')),
    ]),
  ).join(', ');
}

export const battleActionArgs: {
  [lang in LangType]: { [actionName: string]: BattleActionArgs }
} = {
  [LangType.Gl]: require('./gl/battleArgs.json'),
  [LangType.Jp]: require('./jp/battleArgs.json'),
};

export const battleActionDetails: { [actionName: string]: BattleActionDetails } = {
  HealHpAction: {
    formula: 'Magical',
    args: {
      factor: 1,
      matkElement: 2,
      damageFactor: 3,
    },
    formatEnlir: formatEnlirHeal,
  },

  HealHpAndCustomParamAction: {
    args: {
      factor: 1,
      matkElement: 2,
      damageFactor: 3,
      statusAilmentsBoostIsAbsolute: 6,
      statusAilmentsOptionsDuration: 5,
      statusAilmentsBoostValue: 4,
    },
    multiArgs: {},
    formatEnlir(battleData: BattleData, options: Options, args: NamedArgs): string {
      return (
        formatEnlirHeal(battleData, options, args) +
        ', ' +
        formatStatuses(battleData, [+options.status_ailments_id])
      );
    },
  },

  HealHpAndHealSaAction: {
    formula: 'Magical',
    args: {
      factor: 1,
      matkElement: 2,
      damageFactor: 3,
    },
    formatEnlir(battleData: BattleData, options: Options, args: NamedArgs): string {
      return (
        formatEnlirHeal(battleData, options, args) +
        `, removes ${formatStatuses(battleData, args.unsetSaId, args.unsetSaBundle)}`
      );
    },
  },

  // This is used for simple single-hit magic attacks, like a magicite's auto-attack.
  MagicAttackAction: {
    args: {
      damageFactor: 1,
      matkElement: 2,
      minDamageFactor: 3,
    },
    multiArgs: {},
    formatEnlir: formatEnlirAttack,
  },

  MagicAttackMultiAction: {
    formula: 'Magical',
    args: {
      damageFactor: 1,
      matkElement: 2,
      minDamageFactor: 3, // TODO: implement
      barrageNum: 4,
      isSameTarget: 5,
      situationalRecalculateDamageHookType: 7, // TODO: implement
      damageCalculateParamAdjust: 8, // TODO: implement
      damageCalculateTypeByAbility: 13, // TODO: implement
      matkExponentialFactor: 14, // TODO: implement
    },
    multiArgs: {
      damageCalculateParamAdjustConf: [9, 10, 11, 12],
    },
    formatEnlir: formatEnlirAttack,
  },

  MagicAttackMultiWithMultiElementAction: {
    formula: 'Magical',
    args: {
      damageFactor: 1,
      minDamageFactor: 2,
      barrageNum: 3,
      isSameTarget: 4,
      matkExponentialFactor: 11,
      damageCalculateTypeByAbility: 10,
      damageCalculateParamAdjust: 12,
    },
    multiArgs: {
      damageCalculateParamAdjustConf: [13, 14, 15, 16, 17, 18],
    },
    formatEnlir: formatEnlirAttack,
  },

  // This is used for simple single-hit physical attacks, like an en-element status's
  // Attack replacement.
  PhysicalAttackElementAction: {
    args: {
      damageFactor: 1,
      atkElement: 2,
      atkType: 3,
      forceHit: 4,
    },
    multiArgs: {},
    formatEnlir: formatEnlirAttack,
  },

  PhysicalAttackMultiAction: {
    args: {
      damageFactor: 1,
      barrageNum: 2,
      atkType: 3,
      forceHit: 4,
      atkElement: 5,
      isSameTarget: 6,
      situationalRecalculateDamageHookType: 9,
      atkExponentialFactor: 16, // TODO: Implement
      critical: 7,
      damageCalculateParamAdjust: 8,
      damageCalculateTypeByAbility: 14,
    },
    multiArgs: {
      damageCalculateParamAdjustConf: [10, 11, 12, 13, 15],
    },
    formatEnlir: formatEnlirAttack,
  },

  PhysicalAttackMultiAndHealHpByHitDamageAction: {
    formula: 'Physical',
    args: {
      damageFactor: 1,
      barrageNum: 2,
      atkType: 3,
      forceHit: 4,
      isSameTarget: 6,
      healHpFactor: 7,
    },
    formatEnlir(battleData: BattleData, options: Options, args: NamedArgs): string {
      return (
        formatEnlirAttack(battleData, options, args) +
        `, heals the user for ${args.healHpFactor}% of the damage dealt`
      );
    },
  },

  PhysicalAttackMultiAndHpBarterAndSelfSaAction: {
    formula: 'Physical',
    args: {
      damageFactor: 1,
      barterRate: 2,
      atkType: 4,
      forceHit: 5,
      barrageNum: 6,
      isSameTarget: 7,
      selfSaBundleId: 9,
      selfSaOptionsDuration: 10,
      ignoresAttackHit: 11,
      selfSaAnimationFlag: 12,
    },
    formatEnlir(battleData: BattleData, options: Options, args: NamedArgs): string {
      let result = formatEnlirAttack(battleData, options, args);
      if (args.barterRate) {
        result += `, damages the user for ${args.barterRate / 10}% max HP`;
      }
      // TODO: Implement status ailments
      return result;
    },
  },

  PhysicalAttackMultiAndSelfSaAction: {
    formula: 'Physical',
    args: {
      damageFactor: 1,
      barrageNum: 2,
      atkType: 3,
      forceHit: 4,
      isSameTarget: 6,
      selfSaId: 7,
      ignoresAttackHit: 8,
      selfSaOptionsDuration: 9,
      selfSaAnimationFlag: 10,
      damageCalculateParamAdjust: 12,
      critical: 17,
    },
    multiArgs: {
      damageCalculateParamAdjustConf: [13, 14],
    },
    formatEnlir(battleData: BattleData, options: Options, args: NamedArgs): string {
      let result = formatEnlirAttack(battleData, options, args);
      result += ', ' + formatSelfStatus(battleData, args);
      return result;
    },
  },

  PhysicalAttackMultiWithMultiElementAction: {
    args: {
      damageFactor: 1,
      barrageNum: 2,
      atkType: 3,
      forceHit: 4,
      isSameTarget: 5,
      criticalCoefficient: 10,
      critical: 19,
      damageCalculateParamAdjust: 11,
    },
    multiArgs: {
      damageCalculateParamAdjustConf: [12, 13, 14, 15, 16, 17, 18],
    },
    formatEnlir: formatEnlirAttack,
  },

  // TranceAction: {
  //   args: {
  //     wrappedAbilityId: 1,
  //     optionalSelfSaId: 9,
  //     saSelfOptionsDuration: 6,
  //   },
  //   multiArgs: {
  //     spareReceptorIds: [3, 5],
  //     boostsRate: [7, 7, 7, 7, 7, 7, 7, 8],
  //   },
  // },
};
