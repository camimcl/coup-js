import Case from './Case.ts';
import { PROMPT_OPTION_CHALLENGE_ACCEPT } from '../constants/promptOptions.ts';
import { CARD_VARIANT_AMBASSADOR } from '../constants/cardVariants.ts';
import GameState from '../core/GameState.ts';
import { emitActionLog, emitWarningLog } from '../utils/LogUtil.ts';

export default class AmbassadorCase extends Case {
  constructor(gameState: GameState) {
    super('Embassador', gameState);
  }

  public async runCase(): Promise<void> {
    this.currentPlayer = this.gameState.getCurrentTurnPlayer();

    const {
      challengerId,
      response,
    } = await this.promptService.challengeOthers(
      this.currentPlayer.socket,
      this.gameState.getActivePlayers().length,
      `${this.currentPlayer.name} diz ser o embaixador e deseja trocar de cartas`,
    );

    if (response === PROMPT_OPTION_CHALLENGE_ACCEPT) {
      await this.handleChallenge(challengerId);
    } else {
      await this.performExchange();
      emitActionLog(`Ninguém contesta o embaixador e ${this.currentPlayer.name} recebe e descarta 2 cartas.`, this.gameState.getNamespace())
    }

    this.finishTurn();
  }

  private async handleChallenge(challengerId: string) {
    const challenger = this.gameState.getPlayerByUUID(challengerId);
    emitWarningLog(`${challenger.name}: Contesto o embaixador.`, this.gameState.getNamespace())

    const revealedUUID = await this.promptService.askSingleCard(
      this.currentPlayer,
    );

    const revealedCard = this.currentPlayer.getCardByUUID(revealedUUID);

    if (revealedCard.variant !== CARD_VARIANT_AMBASSADOR) {
      this.gameState.discardPlayerCard(revealedUUID, this.currentPlayer);
      emitWarningLog(`${this.currentPlayer.name} não revela embaixador e descarta uma carta.`, this.gameState.getNamespace())
      return;
    }

    // If the revealed card is the ambassador, the challenger must discard a card
    const challengerCardUUID = await this.promptService.askSingleCard(challenger);
    const discardedUuid = challenger.getCardByUUID(challengerCardUUID);
    this.gameState.discardPlayerCard(challengerCardUUID, challenger);
    emitWarningLog(`${this.currentPlayer.name} revela embaixador e ${challenger.name} perde uma carta.`, this.gameState.getNamespace())
    emitWarningLog(`${challenger.name} descarta um ${discardedUuid.name}.`, this.gameState.getNamespace())

    // currentPlayer returns the ambassador card for replace
    this.gameState.placeCardIntoDeckAndReceiveAnother(revealedUUID, this.currentPlayer);
    emitWarningLog(`${this.currentPlayer.name} substitui a carta.`, this.gameState.getNamespace())
    await this.performExchange();
  }

  private async performExchange() {
    // Salva quantas cartas o jogador tinha antes de comprar
    const initialCardCount = this.currentPlayer.getCards().length;

    // O jogador compra 2 cartas
    this.gameState.drawCardForPlayer(this.currentPlayer);
    this.gameState.drawCardForPlayer(this.currentPlayer);
    emitWarningLog(`${this.currentPlayer.name} Recebe 2 cartas pelo embaixador.`, this.gameState.getNamespace());

    // Coleta todas as cartas atuais após a compra
    const cards = this.currentPlayer.getCards();

    // O jogador deve escolher quantas cartas tinha originalmente
    let keptCardsUUIDs: string[] = [];
    if (initialCardCount === 1) {
      keptCardsUUIDs = [
        await this.promptService.askSingleCard(
          this.currentPlayer,
          'Escolha 1 carta para manter na sua mão'
        ),
      ];
    } else if (initialCardCount === 2) {
      keptCardsUUIDs = await this.promptService.askTwoCards(
        this.currentPlayer,
        'Escolha 2 cartas para manter na sua mão'
      );
    } else if (initialCardCount > 2) {
      // Situação rara, mas cobre qualquer caso futuro
      // Implemente lógica para múltiplas cartas se necessário
      // Por padrão, mantém as primeiras cartas
      keptCardsUUIDs = cards.slice(0, initialCardCount).map(card => card.uuid);
    }

    // Remove as cartas que não foram mantidas
    cards.forEach((card) => {
      if (!keptCardsUUIDs.includes(card.uuid)) {
        this.currentPlayer.removeCardByUUID(card.uuid);
        this.gameState.placeCardIntoDeck(card);
      }
    });
  }
}
