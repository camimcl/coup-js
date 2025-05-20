/* eslint-disable no-console */
import AmbassadorCase from './cases/AmbassadorCase.ts';
import AssassinCase from './cases/AssassinCase.ts';
import CoupCase from './cases/CoupCase.ts';
import CaptainCase from './cases/CaptainCase.ts';
import DukeCase from './cases/DukeCase.ts';
import ForeignAidCase from './cases/ForeignAidCase.ts';
import IncomeCase from './cases/IncomeCase.ts';
import Player from './core/entities/Player.ts';
import Match from './core/Match.ts';
import {
  GAME_START, MESSAGE, TURN_START, PROMPT_RESPONSE,
  ERROR,
  CLEAR_PROMPT,
} from './constants/events.ts';
import Case from './cases/Case.ts';
import { PromptOption, PromptService } from './services/PromptService.ts';

export default function initializeNamespace(
  match: Match,
) {
  const namespace = match.getNamespace();
  const gameState = match.getGameState();
  const promptService = new PromptService(namespace);

  const assassinCase = new AssassinCase(gameState);
  const dukeCase = new DukeCase(gameState);
  const incomeCase = new IncomeCase(gameState);
  const ambassadorCase = new AmbassadorCase(gameState);
  const coupCase = new CoupCase(gameState);
  const foreignAidCase = new ForeignAidCase(gameState);
  const captainCase = new CaptainCase(gameState);

  const cases: { [key: string]: Case } = {
    [assassinCase.getCaseName()]: assassinCase,
    [dukeCase.getCaseName()]: dukeCase,
    [incomeCase.getCaseName()]: incomeCase,
    [ambassadorCase.getCaseName()]: ambassadorCase,
    [coupCase.getCaseName()]: coupCase,
    [foreignAidCase.getCaseName()]: foreignAidCase,
    [captainCase.getCaseName()]: captainCase,
  };

  namespace.on('connection', (socket) => {
    const username = (socket.handshake.auth.username || socket.id) as string;

    if (match.isInProgress()) {
      console.warn(`Player ${username} tried to join an ongoing match.`);

      socket.emit(ERROR, { message: 'Cannot join: match is already in progress.' });

      socket.disconnect();

      return;
    }

    match.addPlayer(new Player(username, socket));

    console.log(`Player ${username} has joined the room ${namespace.name}`);

    socket.on('disconnect', () => {
      console.log(`Player ${socket.id} has left the room ${namespace.name}`);
      match.removePlayer(socket.id);
    });
  });

  async function handleTurn() {
    if (!match.isInProgress()) {
      console.warn('Game is not in progress, cannot move to next turn');
      return;
    }

    const availableOptions: PromptOption[] = Object.values(cases)
      .filter((c) => c.canExecute())
      .map((c) => ({ label: c.getCaseName(), value: c.getCaseName() }));

    const player = match.getGameState().getCurrentTurnPlayer();

    const intervalId = setInterval(() => {
      promptService.emitToPlayer(
        player.socket,
        'O que deseja fazer',
        availableOptions,
      );
    }, 1000);

    const response = await new Promise<string>((resolve) => {
      const timeoutId = setTimeout(() => {
        player.socket.emit(CLEAR_PROMPT);

        clearInterval(intervalId);
        resolve('Income');
      }, 10000);

      player.socket.once(PROMPT_RESPONSE, (res: string) => {
        player.socket.emit(CLEAR_PROMPT);

        clearTimeout(timeoutId);
        clearInterval(intervalId);
        resolve(res);
      });
    });

    const chosenCase = cases[response];

    if (!chosenCase || !chosenCase.canExecute()) {
      player.socket.emit(MESSAGE, { message: 'Cannot execute the given action' });
    } else {
      chosenCase.runCase();
    }
  }

  match.internalBus.on(TURN_START, () => {
    console.debug('Starting next turn');

    handleTurn();
  });

  match.internalBus.on(GAME_START, () => {
    console.debug('Starting game');

    handleTurn();
  });
}
