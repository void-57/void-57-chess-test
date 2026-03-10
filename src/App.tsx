import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Chess960 } from 'void57-chess';
import { IoCopyOutline, IoCheckmark } from 'react-icons/io5';
import { GiChessKing } from 'react-icons/gi';

interface Piece {
  type: string;
  color: string;
}

const pieceSymbols: { [key: string]: string } = {
  'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
  'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
};

const App: React.FC = () => {
  const [game, setGame] = useState<Chess | Chess960>(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<any[]>([]);
  const [gameMode, setGameMode] = useState<string>('standard');
  const [chess960Position, setChess960Position] = useState<number | null>(null);
  const [chess960PositionInput, setChess960PositionInput] = useState<string>('');
  const [board, setBoard] = useState<(Piece | null)[][]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [promotionMove, setPromotionMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState<any>({
    turn: 'w',
    isGameOver: false,
    inCheck: false,
    history: [],
    fen: ''
  });

  const refreshBoard = useCallback(() => {
    setBoard(game.board());
    setStatus({
      turn: game.turn(),
      isGameOver: game.isGameOver(),
      inCheck: game.inCheck(),
      history: game.history(),
      fen: game.fen(),
      isCheckmate: game.isCheckmate(),
      isStalemate: game.isStalemate(),
      isDraw: game.isDraw()
    });
  }, [game]);

  useEffect(() => {
    refreshBoard();
  }, [game, refreshBoard]);

  const handleSquareClick = (square: string) => {
    if (status.isGameOver) {
      return;
    }

    // If clicking the same square, deselect it
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // If no square selected, try to select this square
    if (!selectedSquare) {
      const piece = game.get(square as any);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square: square as any, verbose: true });
        console.log('Available moves from', square, ':', moves);
        console.log('Castling moves:', moves.filter(m => m.flags.includes('k') || m.flags.includes('q')));
        setPossibleMoves(moves);
      }
      return;
    }

    // A square is already selected, check if this is a valid move destination first
    const targetPiece = game.get(square as any);
    const piece = game.get(selectedSquare as any);
    
    // Find all possible moves to this square
    const movesToSquare = possibleMoves.filter(m => m.to === square);
    
    // Special handling: if king is selected and clicking on own rook, try to castle
    let possibleMove;
    let isCastlingToRook = false;
    if (piece && piece.type.toLowerCase() === 'k' && 
        targetPiece && targetPiece.type.toLowerCase() === 'r' && 
        targetPiece.color === game.turn()) {
      
      const selectedFile = selectedSquare.charCodeAt(0);
      const targetFile = square.charCodeAt(0);
      const isKingside = targetFile > selectedFile;
      
      // Find the appropriate castling move (k=kingside, q=queenside)
      possibleMove = possibleMoves.find(m => 
        isKingside ? m.flags.includes('k') : m.flags.includes('q')
      );
      
      isCastlingToRook = possibleMove !== undefined;
      console.log('Castling to rook:', square, 'kingside:', isKingside, 'move:', possibleMove);
    } else {
      // Prioritize castling moves over regular moves
      possibleMove = movesToSquare.find(m => m.flags.includes('k') || m.flags.includes('q')) || movesToSquare[0];
    }
    
    const isValidMove = possibleMove !== undefined;
    
 
    if (targetPiece && targetPiece.color === game.turn() && !isValidMove && !isCastlingToRook) {
      // Select the new piece instead
      setSelectedSquare(square);
      setPossibleMoves(game.moves({ square: square as any, verbose: true }));
      return;
    }
    
    // If clicking on a piece but not valid and not castling to rook, check if we should select it
    if (!isValidMove && !isCastlingToRook) {
      // Invalid move, deselect
      setSelectedSquare(null);
      setPossibleMoves([]);
      return;
    }

    // Check if this is a pawn promotion
    const isPromotion = piece && piece.type.toLowerCase() === 'p' && 
      ((piece.color === 'w' && square[1] === '8') || (piece.color === 'b' && square[1] === '1'));
    
    if (isPromotion) {
      // Show promotion dialog
      setPromotionMove({ from: selectedSquare, to: square });
      return;
    }
    
    // Try to execute the move
    let move = null;
    
    // Check if this is a special move (castling) that requires SAN notation
    const isCastling = possibleMove && (possibleMove.flags.includes('k') || possibleMove.flags.includes('q'));
    
    console.log('Attempting move from', selectedSquare, 'to', square);
    console.log('Possible moves to square:', movesToSquare);
    console.log('Selected move:', possibleMove);
    console.log('Is castling:', isCastling);
    
    if (isCastling) {
      // Use SAN notation for castling moves
      console.log('Executing castling move:', possibleMove.san);
      move = game.move(possibleMove.san);
    } else {
      // Use standard from-to notation for regular moves
      move = game.move({ from: selectedSquare, to: square });
    }
    
    console.log('Move result:', move);
    
    if (move) {
      setSelectedSquare(null);
      setPossibleMoves([]);
      refreshBoard();
    } else {
      // Invalid move, deselect
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  };

  const handlePromotion = (piece: string) => {
    if (!promotionMove) return;
    
    const move = game.move({
      from: promotionMove.from,
      to: promotionMove.to,
      promotion: piece
    });
    
    if (move) {
      setPromotionMove(null);
      setSelectedSquare(null);
      setPossibleMoves([]);
      refreshBoard();
    }
  };

  const startNewGame = (mode: string, position?: number) => {
    let newGame;
    if (mode === 'standard') {
      newGame = new Chess();
      setChess960Position(null);
    } else if (mode === 'chess960') {
      let chess960Pos: number;
      if (position !== undefined) {
        // Use provided position
        chess960Pos = position;
      } else if (chess960PositionInput) {
        // Use input field value
        const inputPos = parseInt(chess960PositionInput, 10);
        if (inputPos >= 0 && inputPos <= 959) {
          chess960Pos = inputPos;
        } else {
          alert('Chess960 position must be between 0 and 959');
          return;
        }
      } else {
        // Generate random position
        chess960Pos = Math.floor(Math.random() * 960);
      }
      const chess960Game = new Chess960(chess960Pos);
      newGame = chess960Game;
      setChess960Position(chess960Pos);
      setChess960PositionInput(''); // Clear input after use
    } else {
      newGame = new Chess();
      setChess960Position(null);
    }
    setGame(newGame);
    setGameMode(mode);
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  const undoMove = () => {
    game.undo();
    setSelectedSquare(null);
    setPossibleMoves([]);
    refreshBoard();
  };

  const resetGame = () => {
    game.reset();
    setSelectedSquare(null);
    setPossibleMoves([]);
    refreshBoard();
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const renderSquare = (row: number, col: number) => {
    const squareName = String.fromCharCode(97 + col) + (8 - row);
    const isLight = (row + col) % 2 === 0;
    const piece = board[row] ? board[row][col] : null;
    const isSelected = selectedSquare === squareName;
    const possibleMove = possibleMoves.find(m => m.to === squareName);
    const isCapture = possibleMove && piece;
    
    // Check if this square is a rook that can be clicked for castling
    const isCastlingRook = selectedSquare && piece && piece.type.toLowerCase() === 'r' && 
      piece.color === game.turn() && possibleMoves.some(m => {
        if (!m.flags.includes('k') && !m.flags.includes('q')) return false;
        const selectedFile = selectedSquare.charCodeAt(0);
        const rookFile = squareName.charCodeAt(0);
        const isKingside = rookFile > selectedFile;
        return isKingside ? m.flags.includes('k') : m.flags.includes('q');
      });

    return (
      <div 
        key={squareName}
        className={`square ${isLight ? 'light' : 'dark'} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleSquareClick(squareName)}
      >
        {piece && (
          <span className={`piece ${piece.color === 'w' ? 'white' : 'black'}`}>
            {pieceSymbols[piece.color === 'w' ? piece.type.toUpperCase() : piece.type.toLowerCase()]}
          </span>
        )}
        {possibleMove && !isCapture && <div className="move-dot" />}
        {possibleMove && isCapture && <div className="move-ring" />}
        {isCastlingRook && <div className="move-ring" />}
      </div>
    );
  };

  const renderBoard = () => {
    const rows = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        rows.push(renderSquare(row, col));
      }
    }
    return rows;
  };

  const getStatusText = () => {
    if (status.isCheckmate) return `Checkmate! ${status.turn === 'w' ? 'Black' : 'White'} wins!`;
    if (status.isStalemate) return "Stalemate - Draw!";
    if (status.isDraw) return "Draw!";
    if (status.inCheck) return "Check!";
    return status.turn === 'w' ? "White's turn" : "Black's turn";
  };

  return (
    <div className="app">
      <header className="header">
        <div className="title-section">
          <div className="logo-title">
            <GiChessKing className="chess-logo" />
            <h1>void57-chess</h1>
          </div>
          <p className="subtitle">Testing Chess & Chess960</p>
        </div>
        
        <div className="controls">
          <div className="control-group">
            <label>New Game</label>
            <div className="button-row">
              <button onClick={() => startNewGame('standard')} className="btn-primary">Standard</button>
              <button onClick={() => startNewGame('chess960')} className="btn-primary">Chess960</button>
            </div>
          </div>
          <div className="control-group chess960-input">
            <label>Chess960 Position (0-959)</label>
            <div className="position-input-row">
              <input 
                type="number" 
                min="0" 
                max="959" 
                value={chess960PositionInput}
                onChange={(e) => setChess960PositionInput(e.target.value)}
                placeholder="Random"
                className="position-input"
              />
              <button 
                onClick={() => startNewGame('chess960')} 
                className="btn-secondary"
                disabled={!chess960PositionInput && chess960PositionInput !== '0'}
              >
                Start
              </button>
            </div>
          </div>
          <div className="control-group">
            <label>Actions</label>
            <div className="button-row">
              <button onClick={undoMove} className="btn-secondary">Undo</button>
              <button onClick={resetGame} className="btn-secondary">Reset</button>
            </div>
          </div>
        </div>
      </header>

      <main className="game-area">
        <div className="board-section">
          <div className="board-wrapper">
            <div className={`chessboard ${status.isGameOver ? 'game-over' : ''}`}>
              {renderBoard()}
            </div>
          </div>
        </div>

        <aside className="sidebar">
          <div className={`card status-card ${status.isGameOver ? 'game-over' : ''}`}>
            <div className="card-header">
              <h3>Status</h3>
            </div>
            <div className="card-body">
              <div className="status-item">
                <span className="status-label">Turn</span>
                <span className="status-value">{getStatusText()}</span>
              </div>
              <div className="status-item">
                <span className="status-label">Mode</span>
                <span className="status-value">
                  {gameMode === 'standard' ? 'Standard Chess' : `Chess960${chess960Position !== null ? ` #${chess960Position}` : ''}`}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Moves</h3>
              <button 
                onClick={() => copyToClipboard(status.history.join(' '), 'moves')} 
                className="copy-btn"
                title="Copy moves"
              >
                {copied === 'moves' ? <IoCheckmark /> : <IoCopyOutline />}
              </button>
            </div>
            <div className="card-body">
              <div className="moves-list">
                {status.history.length > 0 ? status.history.join(', ') : 'No moves yet'}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Position (FEN)</h3>
              <button 
                onClick={() => copyToClipboard(status.fen, 'fen')} 
                className="copy-btn"
                title="Copy FEN"
              >
                {copied === 'fen' ? <IoCheckmark /> : <IoCopyOutline />}
              </button>
            </div>
            <div className="card-body">
              <div className="fen-display">
                {status.fen}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {promotionMove && (
        <div className="promotion-overlay" onClick={() => setPromotionMove(null)}>
          <div className="promotion-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Choose Promotion Piece</h3>
            <div className="promotion-options">
              <button className="promotion-piece" onClick={() => handlePromotion('q')}>
                {status.turn === 'w' ? pieceSymbols.Q : pieceSymbols.q}
              </button>
              <button className="promotion-piece" onClick={() => handlePromotion('r')}>
                {status.turn === 'w' ? pieceSymbols.R : pieceSymbols.r}
              </button>
              <button className="promotion-piece" onClick={() => handlePromotion('b')}>
                {status.turn === 'w' ? pieceSymbols.B : pieceSymbols.b}
              </button>
              <button className="promotion-piece" onClick={() => handlePromotion('n')}>
                {status.turn === 'w' ? pieceSymbols.N : pieceSymbols.n}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
