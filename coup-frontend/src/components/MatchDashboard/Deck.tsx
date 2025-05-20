import React from 'react';
import { useGameState } from '../../contexts/GameStateProvider';
import BackCard from '../../assets/images/backcard.png'; // importe a imagem do verso

const Deck: React.FC = () => {
  const { gameState } = useGameState();

  if (!gameState) return null;

  const { deckSize } = gameState;
  
  const visibleStackSize = Math.min(deckSize, 7);
  const hasCards = deckSize > 0;

  return (
    <div id="deck" className="deck-container">
      <div className="deck-wrapper">
        <div className="deck-header">
          <div className="deck-title">
            <span className="deck-icon">🎴</span>
            <span className="title-text">Baralho</span>
          </div>
          <div className="deck-counter">
            <span className="counter-value">{deckSize}</span>
            <span className="counter-text">cartas</span>
          </div>
        </div>
        
        <div className="deck-stage">
          {hasCards ? (
            <div className="cards-stack" aria-label={`Deck with ${deckSize} cards remaining`}>
              {Array.from({ length: visibleStackSize }).map((_, index) => (
                <div 
                  key={index}
                  className="deck-card"
                  style={{ 
                    '--card-index': index,
                    '--total-cards': visibleStackSize
                  } as React.CSSProperties}
                >
                  <div className="card-face">
                    <img
                      src={BackCard}
                      alt="Verso da carta"
                      className="deck-back-image"
                      draggable={false}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                    />
                  </div>
                  <div className="card-edge top"></div>
                  <div className="card-edge right"></div>
                  <div className="card-edge bottom"></div>
                  <div className="card-edge left"></div>
                  <div className="card-shadow"></div>
                </div>
              ))}
              
              {deckSize > visibleStackSize && (
                <div className="remaining-indicator">
                  +{deckSize - visibleStackSize}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-deck">
              <div className="empty-icon">🎭</div>
              <p>Sem cartas!</p>
            </div>
          )}
        </div>
      </div>

      <div className="deck-decorations">
        <div className="deck-sparkle sparkle-1"></div>
        <div className="deck-sparkle sparkle-2"></div>
        <div className="deck-sparkle sparkle-3"></div>
      </div>
    </div>
  );
};

export default Deck;