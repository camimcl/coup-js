import { CardVariant } from '../../constants/cardVariants.ts';

const CARD_NAMES: Record<CardVariant, string> = {
  CARD_VARIANT_AMBASSADOR: 'Embaixador',
  CARD_VARIANT_ASSASSIN: 'Assassino',
  CARD_VARIANT_CAPTAIN: 'Capitão',
  CARD_VARIANT_DUKE: 'Duque',
  CARD_VARIANT_CONDESSA: 'Condessa',
};

export default class Card {
  public readonly uuid: string;

  public readonly variant: CardVariant;

  public readonly name: string;

  constructor(variant: CardVariant) {
    this.uuid = crypto.randomUUID();
    this.variant = variant;
    this.name = CARD_NAMES[variant];
  }
}
