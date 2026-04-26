/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, RefreshCw, AlertCircle, Play, ChevronRight, MapPin, Search, Plus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { COUNTRIES } from './constants';
import { GameStatus, Player, GameState } from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentTurnIndex: 0,
    countryChain: [],
    status: 'setup',
  });

  const [playerCountInput, setPlayerCountInput] = useState<string>('2');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [recallIndex, setRecallIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const players = gameState.players;
  const currentPlayer = players[gameState.currentTurnIndex];
  const isAITurn = currentPlayer?.isAI;

  const showFeedback = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedback({ type, message });
    feedbackTimeoutRef.current = setTimeout(() => setFeedback(null), 3000);
  }, []);

  const startGame = () => {
    const aiCount = parseInt(playerCountInput);
    if (isNaN(aiCount) || aiCount < 1) {
      showFeedback('error', 'Need at least 1 AI opponent');
      return;
    }

    const newPlayers: Player[] = [
      {
        id: 'human',
        name: 'You (Human)',
        isAI: false,
        isEliminated: false,
      }
    ];

    for (let i = 0; i < aiCount; i++) {
      newPlayers.push({
        id: `ai-${i}`,
        name: `AI Unit ${i + 1}`,
        isAI: true,
        isEliminated: false,
      });
    }

    setGameState({
      players: newPlayers,
      currentTurnIndex: 0,
      countryChain: [],
      status: 'playing',
    });
    setRecallIndex(0);
    setCurrentInput('');
    setFeedback(null);
  };

  const eliminatePlayer = (reason: string) => {
    const playerToEliminate = players[gameState.currentTurnIndex];
    const updatedPlayers = players.map(p => 
      p.id === playerToEliminate.id ? { ...p, isEliminated: true } : p
    );

    const activePlayers = updatedPlayers.filter(p => !p.isEliminated);
    
    if (activePlayers.length === 1) {
      setGameState(prev => ({
        ...prev,
        players: updatedPlayers,
        status: 'winner'
      }));
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      setGameState(prev => {
        let nextIndex = (prev.currentTurnIndex + 1) % prev.players.length;
        while (updatedPlayers[nextIndex].isEliminated) {
          nextIndex = (nextIndex + 1) % prev.players.length;
        }
        return {
          ...prev,
          players: updatedPlayers,
          currentTurnIndex: nextIndex,
          status: 'playing'
        };
      });
      setRecallIndex(0);
      setCurrentInput('');
      showFeedback('error', `${playerToEliminate.name} eliminated: ${reason}`);
    }
  };

  const nextTurn = (newCountry: string) => {
    setGameState(prev => {
      const activePlayers = prev.players.filter(p => !p.isEliminated);
      let nextIndex = (prev.currentTurnIndex + 1) % prev.players.length;
      while (prev.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % prev.players.length;
      }

      return {
        ...prev,
        countryChain: [...prev.countryChain, newCountry],
        currentTurnIndex: nextIndex,
      };
    });
    setRecallIndex(0);
    setCurrentInput('');
    showFeedback('success', `Added ${newCountry}! Next turn.`);
  };

  const handleInputSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!currentInput.trim()) return;

    const normalizedInput = currentInput.trim().toLowerCase();
    
    // Phase 1: Recalling existing chain
    if (recallIndex < gameState.countryChain.length) {
      const expected = gameState.countryChain[recallIndex].toLowerCase();
      if (normalizedInput === expected) {
        setRecallIndex(prev => prev + 1);
        setCurrentInput('');
      } else {
        eliminatePlayer(`Forgot/Misordered chain. Expected "${gameState.countryChain[recallIndex]}".`);
      }
    } 
    // Phase 2: Adding a new country
    else {
      const countryExists = COUNTRIES.some(c => c.toLowerCase() === normalizedInput);
      const matchedCountry = COUNTRIES.find(c => c.toLowerCase() === normalizedInput) || currentInput.trim();
      
      if (!countryExists) {
        eliminatePlayer(`"${currentInput}" is not in our country list.`);
        return;
      }

      const isRepeat = gameState.countryChain.some(c => c.toLowerCase() === normalizedInput);
      if (isRepeat) {
        eliminatePlayer(`"${matchedCountry}" was already used.`);
        return;
      }

      nextTurn(matchedCountry);
    }
  };

  // AI Turn Logic
  useEffect(() => {
    if (isAITurn && gameState.status === 'playing') {
      const playAI = async () => {
        // Step 1: Recall existing
        for (let i = 0; i < gameState.countryChain.length; i++) {
          await new Promise(r => setTimeout(r, 800));
          setCurrentInput(gameState.countryChain[i]);
          await new Promise(r => setTimeout(r, 400));
          setRecallIndex(i + 1);
          setCurrentInput('');
        }

        // Step 2: Add new
        await new Promise(r => setTimeout(r, 1000));
        const unusedCountries = COUNTRIES.filter(c => !gameState.countryChain.includes(c));
        const randomIndex = Math.floor(Math.random() * unusedCountries.length);
        const choice = unusedCountries[randomIndex];
        
        setCurrentInput(choice);
        await new Promise(r => setTimeout(r, 600));
        nextTurn(choice);
      };

      playAI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAITurn, gameState.status, gameState.currentTurnIndex]);

  const resetGame = () => {
    setGameState({
      players: [],
      currentTurnIndex: 0,
      countryChain: [],
      status: 'setup',
    });
    setPlayerCountInput('2');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-sky-500/30 overflow-x-hidden">
      {/* Header Accent */}
      <div className="fixed top-0 left-0 w-full h-1 bg-sky-500 z-50" />

      <main className="max-w-[1200px] mx-auto px-6 py-12 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {/* SETUP SCREEN */}
          {gameState.status === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex-1 flex flex-col justify-center max-w-2xl"
            >
              <div className="space-y-4 mb-16">
                <p className="text-sky-400 font-mono text-sm tracking-[0.3em] uppercase">Game Master Protocol v1.0</p>
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase italic leading-[0.8] mb-8">
                  Country<br />Chain
                </h1>
                <p className="text-slate-400 text-lg max-w-md font-medium leading-relaxed">
                  A high-velocity memory challenge. Build the chain. Don{"'"}t break the sequence.
                </p>
              </div>

              <div className="space-y-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 uppercase text-xs font-bold tracking-widest">Select AI Opponents</span>
                    <div className="h-px flex-1 bg-slate-800" />
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        onClick={() => setPlayerCountInput(num.toString())}
                        className={cn(
                          "w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black transition-all border-2",
                          playerCountInput === num.toString() 
                            ? "bg-sky-500 text-slate-950 border-sky-500 scale-110 shadow-[0_0_20px_rgba(14,165,233,0.3)]" 
                            : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600"
                        )}
                      >
                        {num}
                      </button>
                    ))}
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Custom"
                        className="w-24 h-16 rounded-2xl bg-slate-900 border-2 border-slate-800 focus:border-sky-500 outline-none text-center font-black text-xl transition-all"
                        value={playerCountInput}
                        onChange={(e) => setPlayerCountInput(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={startGame}
                  className="group relative inline-flex items-center gap-6 px-12 py-6 bg-sky-500 text-slate-950 rounded-full font-black uppercase tracking-tighter transition-all hover:bg-sky-400 hover:scale-105 active:scale-95"
                >
                  <span className="text-xl">Begin Protocol</span>
                  <ChevronRight className="w-6 h-6 transition-transform group-hover:translate-x-2" />
                  <div className="absolute inset-0 rounded-full border-4 border-sky-500 scale-110 opacity-0 group-hover:opacity-20 transition-all" />
                </button>
              </div>
            </motion.div>
          )}

          {/* PLAYING SCREEN */}
          {gameState.status === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col gap-12"
            >
              {/* Game Header */}
              <header className="flex justify-between items-end border-b border-slate-800 pb-8">
                <div>
                  <p className="text-sky-400 font-mono text-sm tracking-widest uppercase mb-2">Active Memory Engine</p>
                  <h1 className="text-5xl font-black tracking-tighter uppercase italic">Country Chain</h1>
                </div>
                <div className="flex gap-8 items-end">
                  <div className="text-right">
                    <p className="text-slate-500 uppercase text-xs font-bold tracking-widest mb-1">Index</p>
                    <p className="text-5xl font-mono leading-none font-bold text-sky-400">
                      {String(gameState.countryChain.length).padStart(2, '0')}
                    </p>
                  </div>
                  <button onClick={resetGame} className="mb-1 p-2 bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors border border-slate-800">
                    <RefreshCw className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </header>

              <div className="flex-1 grid grid-cols-12 gap-12">
                {/* Player Sidebar */}
                <aside className="col-span-12 lg:col-span-3 flex flex-col gap-6">
                  <h3 className="text-slate-500 uppercase text-xs font-bold tracking-widest">Personnel</h3>
                  <div className="space-y-3">
                    {players.map((p) => (
                      <div 
                        key={p.id} 
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border-l-[6px] transition-all",
                          p.id === currentPlayer?.id 
                            ? "bg-slate-900 border-sky-400 shadow-xl scale-[1.02]" 
                            : "bg-slate-900/30 border-transparent opacity-60",
                          p.isEliminated && "bg-red-950/10 border-red-500 opacity-40 grayscale"
                        )}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          p.id === currentPlayer?.id ? "bg-sky-400 animate-pulse" : "bg-slate-600",
                          p.isEliminated && "bg-red-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "font-bold tracking-tight block truncate uppercase",
                            p.isEliminated && "line-through text-red-400"
                          )}>
                            {p.name}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
                            {p.id === currentPlayer?.id ? "PROTOCOL ACTIVE" : p.isEliminated ? "DISCONNECTED" : "STANDBY"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>

                {/* Main Chain Content */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="bg-sky-500 text-slate-950 px-2 py-0.5 text-xs font-black uppercase tracking-tighter">
                        Current Sequence
                      </span>
                      <h2 className="text-4xl font-bold mt-2 uppercase tracking-tighter">
                        {isAITurn ? "AI IS RECALLING..." : `${currentPlayer?.name}'s Turn`}
                      </h2>
                    </div>
                  </div>

                  {/* The Chain Scroll Area */}
                  <div className="flex-1 bg-slate-900/20 rounded-[2rem] border-2 border-slate-900 p-8 min-h-[300px] overflow-y-auto">
                    <div className="flex flex-wrap gap-6 content-start justify-center py-10">
                      {gameState.countryChain.map((country, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-3">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ 
                              scale: 1,
                              backgroundColor: idx < recallIndex ? '#38bdf8' : '#0f172a',
                              boxShadow: idx === recallIndex ? '0 0 30px rgba(56, 189, 248, 0.4)' : 'none'
                            }}
                            className={cn(
                              "w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all",
                              idx === recallIndex ? "border-sky-400" : "border-slate-800"
                            )}
                          >
                            <span className={cn(
                              "font-mono text-xs font-bold",
                              idx < recallIndex ? "text-slate-950" : "text-slate-500"
                            )}>
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                          </motion.div>
                          <AnimatePresence>
                            {(idx === recallIndex && !isAITurn) && (
                              <motion.span
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-[10px] font-black uppercase text-sky-400 tracking-widest"
                              >
                                Target Node
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                      {recallIndex === gameState.countryChain.length && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-16 h-16 rounded-full border-4 border-dashed border-sky-400/30 flex items-center justify-center"
                        >
                          <Plus className="w-6 h-6 text-sky-400/30" />
                        </motion.div>
                      )}
                      
                      {gameState.countryChain.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center py-20 text-slate-800 gap-4">
                          <MapPin className="w-24 h-24 stroke-[4]" />
                          <p className="font-mono text-sm uppercase tracking-widest">Neural Network Empty</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Input Interaction Area */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                    <div className="flex-1 relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2">
                        <Search className="w-5 h-5 text-slate-600" />
                      </div>
                      <input
                        autoFocus
                        disabled={isAITurn}
                        type="text"
                        className={cn(
                          "w-full h-20 bg-slate-900 rounded-3xl border-2 border-slate-800 px-16 text-2xl font-black uppercase tracking-tighter outline-none focus:border-sky-500 transition-all placeholder:text-slate-800",
                          isAITurn && "opacity-50 grayscale"
                        )}
                        placeholder={recallIndex < gameState.countryChain.length ? "RECALL PREVIOUS..." : "ADD NEW COUNTRY..."}
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                      />
                    </div>
                    <button 
                      onClick={() => handleInputSubmit()}
                      disabled={isAITurn}
                      className="h-20 px-12 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black uppercase tracking-tighter transition-all rounded-3xl disabled:opacity-50 disabled:grayscale"
                    >
                      Process Input
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* WINNER SCREEN */}
          {gameState.status === 'winner' && (
            <motion.div
              key="winner"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-12"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-sky-500 blur-[80px] opacity-20" />
                <div className="relative inline-flex p-10 bg-sky-500 rounded-full">
                  <Trophy className="w-24 h-24 text-slate-950" />
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-sky-400 font-mono text-xl tracking-[0.4em] uppercase font-bold">Supreme Champion</p>
                <h2 className="text-7xl md:text-[8rem] font-black tracking-tighter uppercase italic border-y-8 border-sky-500/10 py-8">
                  {players.find(p => !p.isEliminated)?.name}
                </h2>
                <div className="flex justify-center gap-12 pt-8">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Final Chain</p>
                    <p className="text-5xl font-black text-sky-400">{gameState.countryChain.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Precision</p>
                    <p className="text-5xl font-black text-slate-100">100%</p>
                  </div>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="px-16 py-6 bg-slate-50 text-slate-950 rounded-full font-black text-xl uppercase tracking-tighter hover:bg-white hover:scale-105 transition-all"
              >
                Restart Session
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Persistence Labels */}
      <footer className="fixed bottom-0 left-0 w-full p-8 flex justify-between items-center pointer-events-none z-10">
        <div className="flex items-center gap-3 text-slate-600 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          System Online: Memory Engine Active
        </div>
        <div className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">
          Strict Order Mode: Enabled
        </div>
      </footer>

      {/* FEEDBACK TOAST */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={cn(
              "px-8 py-4 rounded-2xl text-slate-950 font-black uppercase tracking-tighter text-lg shadow-2xl flex items-center gap-4 border-b-4",
              feedback.type === 'error' ? "bg-red-500 border-red-700" : "bg-sky-500 border-sky-700"
            )}>
              {feedback.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
              {feedback.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
