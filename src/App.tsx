/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Users, RefreshCw, AlertCircle, Play, ChevronRight, MapPin, Search, Plus, Apple, User, Film, Globe } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from './lib/utils';
import { TOPICS } from './constants';
import { GameStatus, Player, GameState, TopicKey } from './types';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: [],
    currentTurnIndex: 0,
    chain: [],
    status: 'setup',
    topic: 'countries',
  });

  const [playerCountInput, setPlayerCountInput] = useState<string>('2');
  const [selectedTopic, setSelectedTopic] = useState<TopicKey>('countries');
  const [currentInput, setCurrentInput] = useState<string>('');
  const [recallIndex, setRecallIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const players = gameState.players;
  const currentPlayer = players[gameState.currentTurnIndex];
  const isAITurn = currentPlayer?.isAI;
  const currentTopicData = TOPICS[gameState.topic].data;

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
      chain: [],
      status: 'playing',
      topic: selectedTopic,
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

  const nextTurn = (newItem: string) => {
    setGameState(prev => {
      let nextIndex = (prev.currentTurnIndex + 1) % prev.players.length;
      while (prev.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % prev.players.length;
      }

      return {
        ...prev,
        chain: [...prev.chain, newItem],
        currentTurnIndex: nextIndex,
      };
    });
    setRecallIndex(0);
    setCurrentInput('');
    showFeedback('success', `Added ${newItem}! Next turn.`);
  };

  const handleInputSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!currentInput.trim()) return;

    const normalizedInput = currentInput.trim().toLowerCase();
    
    // Phase 1: Recalling existing chain
    if (recallIndex < gameState.chain.length) {
      const expected = gameState.chain[recallIndex].toLowerCase();
      if (normalizedInput === expected) {
        setRecallIndex(prev => prev + 1);
        setCurrentInput('');
      } else {
        eliminatePlayer(`Sequence Error. Expected "${gameState.chain[recallIndex]}".`);
      }
    } 
    // Phase 2: Adding a new item
    else {
      const itemExists = currentTopicData.some(item => item.toLowerCase() === normalizedInput);
      const matchedItem = currentTopicData.find(item => item.toLowerCase() === normalizedInput) || currentInput.trim();
      
      if (!itemExists) {
        eliminatePlayer(`"${currentInput}" is not recognized in the ${TOPICS[gameState.topic].name} database.`);
        return;
      }

      const isRepeat = gameState.chain.some(item => item.toLowerCase() === normalizedInput);
      if (isRepeat) {
        eliminatePlayer(`"${matchedItem}" was already used in this sequence.`);
        return;
      }

      nextTurn(matchedItem);
    }
  };

  // AI Turn Logic
  useEffect(() => {
    if (isAITurn && gameState.status === 'playing') {
      const playAI = async () => {
        // Step 1: Recall existing
        for (let i = 0; i < gameState.chain.length; i++) {
          await new Promise(r => setTimeout(r, 800));
          setCurrentInput(gameState.chain[i]);
          await new Promise(r => setTimeout(r, 400));
          setRecallIndex(i + 1);
          setCurrentInput('');
        }

        // Step 2: Add new
        await new Promise(r => setTimeout(r, 1000));
        const unusedItems = currentTopicData.filter(item => !gameState.chain.includes(item));
        const randomIndex = Math.floor(Math.random() * unusedItems.length);
        const choice = unusedItems[randomIndex];
        
        setCurrentInput(choice);
        await new Promise(r => setTimeout(r, 600));
        nextTurn(choice);
      };

      playAI();
    }
  }, [isAITurn, gameState.status, gameState.currentTurnIndex, currentTopicData, gameState.chain]);

  const resetGame = () => {
    setGameState({
      players: [],
      currentTurnIndex: 0,
      chain: [],
      status: 'setup',
      topic: 'countries',
    });
    setPlayerCountInput('2');
  };

  const getTopicIcon = (topic: TopicKey) => {
    switch (topic) {
      case 'countries': return <Globe className="w-5 h-5" />;
      case 'fruits': return <Apple className="w-5 h-5" />;
      case 'names': return <User className="w-5 h-5" />;
      case 'movies': return <Film className="w-5 h-5" />;
    }
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
              className="flex-1 flex flex-col justify-center max-w-4xl"
            >
              <div className="space-y-4 mb-8">
                <p className="text-sky-400 font-mono text-sm tracking-[0.3em] uppercase">Multi-Topic Neural Link Active</p>
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter uppercase italic leading-[0.8] mb-8">
                  The<br />Chain
                </h1>
                <p className="text-slate-400 text-lg max-w-md font-medium leading-relaxed">
                  A high-velocity memory challenge across multiple domains. Build the sequence. Reach singularity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 uppercase text-xs font-bold tracking-widest">Select Domain</span>
                      <div className="h-px flex-1 bg-slate-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {(Object.keys(TOPICS) as TopicKey[]).map((topic) => (
                        <button
                          key={topic}
                          onClick={() => setSelectedTopic(topic)}
                          className={cn(
                            "group p-6 rounded-2xl border-2 flex flex-col gap-4 text-left transition-all",
                            selectedTopic === topic
                              ? "bg-sky-500 border-sky-500 text-slate-950 shadow-[0_0_30px_rgba(14,165,233,0.3)]"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            selectedTopic === topic ? "bg-slate-950 text-sky-500" : "bg-slate-800 text-slate-500 group-hover:text-slate-300"
                          )}>
                            {getTopicIcon(topic)}
                          </div>
                          <span className="font-black uppercase tracking-tighter text-xl">{TOPICS[topic].name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 uppercase text-xs font-bold tracking-widest">AI Entities</span>
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
                              ? "bg-sky-500 text-slate-950 border-sky-500 scale-110" 
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600"
                          )}
                        >
                          {num}
                        </button>
                      ))}
                      <input
                        type="number"
                        placeholder="+"
                        className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-slate-800 focus:border-sky-500 outline-none text-center font-black text-xl transition-all"
                        value={playerCountInput}
                        onChange={(e) => setPlayerCountInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    className="w-full group relative inline-flex items-center justify-between px-12 py-8 bg-sky-500 text-slate-950 rounded-3xl font-black uppercase tracking-tighter transition-all hover:bg-sky-400 hover:scale-[1.02] active:scale-95 shadow-xl shadow-sky-500/20"
                  >
                    <span className="text-2xl">Initialize Match</span>
                    <ChevronRight className="w-8 h-8 transition-transform group-hover:translate-x-2" />
                  </button>
                </div>
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
                  <p className="text-sky-400 font-mono text-sm tracking-widest uppercase mb-2">Domain: {TOPICS[gameState.topic].name}</p>
                  <h1 className="text-5xl font-black tracking-tighter uppercase italic">{TOPICS[gameState.topic].name} Chain</h1>
                </div>
                <div className="flex gap-8 items-end">
                  <div className="text-right">
                    <p className="text-slate-500 uppercase text-xs font-bold tracking-widest mb-1">Index</p>
                    <p className="text-5xl font-mono leading-none font-bold text-sky-400">
                      {String(gameState.chain.length).padStart(2, '0')}
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
                  <h3 className="text-slate-500 uppercase text-xs font-bold tracking-widest">Network Units</h3>
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
                            {p.id === currentPlayer?.id ? "ACTIVE NODE" : p.isEliminated ? "DE-SYNCED" : "LINKED"}
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
                        Current Memory Trace
                      </span>
                      <h2 className="text-4xl font-bold mt-2 uppercase tracking-tighter">
                        {isAITurn ? "AI IS PROCESSING..." : `Your Turn: Recall Sequence`}
                      </h2>
                    </div>
                  </div>

                  {/* The Chain Scroll Area */}
                  <div className="flex-1 bg-slate-900/20 rounded-[2rem] border-2 border-slate-900 p-8 min-h-[300px] overflow-y-auto">
                    <div className="flex flex-wrap gap-6 content-start justify-center py-10">
                      {gameState.chain.map((_, idx) => (
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
                                className="text-[10px] font-black uppercase text-sky-400 tracking-widest text-center"
                              >
                                Target Node
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                      {recallIndex === gameState.chain.length && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-16 h-16 rounded-full border-4 border-dashed border-sky-400/30 flex items-center justify-center"
                        >
                          <Plus className="w-6 h-6 text-sky-400/30" />
                        </motion.div>
                      )}
                      
                      {gameState.chain.length === 0 && (
                        <div className="w-full flex flex-col items-center justify-center py-20 text-slate-800 gap-4">
                          <MapPin className="w-24 h-24 stroke-[4]" />
                          <p className="font-mono text-sm uppercase tracking-widest">Neural Network Synced</p>
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
                        placeholder={recallIndex < gameState.chain.length ? `RECALL #${recallIndex + 1}...` : "APPEND NEW NODE..."}
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
                      Sync Link
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
                <p className="text-sky-400 font-mono text-xl tracking-[0.4em] uppercase font-bold">Supreme Network Authority</p>
                <h2 className="text-7xl md:text-[8rem] font-black tracking-tighter uppercase italic border-y-8 border-sky-500/10 py-8">
                  {players.find(p => !p.isEliminated)?.name}
                </h2>
                <div className="flex justify-center gap-12 pt-8">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Sequence Depth</p>
                    <p className="text-5xl font-black text-sky-400">{gameState.chain.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Memory Latency</p>
                    <p className="text-5xl font-black text-slate-100">0.0ms</p>
                  </div>
                </div>
              </div>

              <button
                onClick={resetGame}
                className="px-16 py-6 bg-slate-50 text-slate-950 rounded-full font-black text-xl uppercase tracking-tighter hover:bg-white hover:scale-105 transition-all"
              >
                Re-Initialize
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
          Topic Domain: {TOPICS[gameState.topic].name}
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
