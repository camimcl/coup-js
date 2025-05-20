import React from 'react';
import Players from './Players';
import Deck from './Deck';
import DiscardedCards from './DiscardedCards';
import PromptWrapper from './PromptWrapper';
import Logs from './Logs';
import PlayerCards from './PlayerCards';
import { useMatch } from '../../contexts/MatchProvider';

const MatchDashboard: React.FC = () => {
  const { match } = useMatch();

  return <div className="match-dashboard coup-layout">
    <div className="stage-backdrop">
      <div className="backdrop-curtain curtain-left"></div>
      <div className="backdrop-curtain curtain-right"></div>
      <div className="spotlight spotlight-1"></div>
      <div className="spotlight spotlight-2"></div>
      <div className="spotlight spotlight-3"></div>
    </div>

    {
      match?.winner && <EndGameModal winnerName={match.winner} />
    }

    <Players />
    <Deck />
    <DiscardedCards />
    <PromptWrapper />
    <Logs />
    <PlayerCards />

    <div className="floating-decorations">
      <div className="floating-die"></div>
      <div className="floating-coin"></div>
      <div className="floating-card"></div>
    </div>
  </div>

}

export const EndGameModal: React.FC<{ winnerName: string }> = ({ winnerName }) => {
  return <div className='end-game-modal'>
    <div className="post-connect-container">
      <div className="waiting-room-card flex flex-col items-center">
        <h1 id='end-game-title' className='cards-title'>{winnerName} VENCEU!!!</h1>
        <button
          onClick={() => {window.location.href = "/"}}
          className="coup-button create-button"
        >
          <span className="button-text">VOLTAR PARA O INÍCIO</span>
          <div className="button-confetti"></div>
        </button>
      </div>
    </div>
  </div>
}

export default MatchDashboard;
