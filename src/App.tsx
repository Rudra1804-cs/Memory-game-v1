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
  const [topicLog, setTopicLog] = useState<{ item: string, player: string }[]>([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setTopicLog([]);
    setRecallIndex(0);
    setCurrentInput('');
    setFeedback(null);
  };

  const suggestions = (() => {
    const input = currentInput.toLowerCase().trim();
    if (input.length < 2) return [];

    // Case 1: Recalling the sequence
    if (recallIndex < gameState.chain.length) {
      const target = gameState.chain[recallIndex];
      const targetLower = target.toLowerCase();
      
      if (targetLower.startsWith(input) && input.length >= (targetLower.length * 0.4)) {
        return [target];
      }
      return [];
    }

    // Case 2: Adding a new node
    return currentTopicData.filter(item => {
      const itemLower = item.toLowerCase();
      const startsWith = itemLower.startsWith(input);
      const isThresholdMet = input.length >= (itemLower.length * 0.4);
      const isAlreadyUsed = gameState.chain.some(c => c.toLowerCase() === itemLower);
      
      return startsWith && isThresholdMet && !isAlreadyUsed;
    }).slice(0, 3);
  })();

  const handleInputSubmit = (e?: FormEvent, overrideValue?: string) => {
    e?.preventDefault();
    const targetValue = overrideValue || currentInput;
    if (!targetValue.trim()) return;

    const normalizedInput = targetValue.trim().toLowerCase();
    
    if (recallIndex < gameState.chain.length) {
      const expected = gameState.chain[recallIndex].toLowerCase();
      if (normalizedInput === expected) {
        setRecallIndex(prev => prev + 1);
        setCurrentInput('');
      } else {
        eliminatePlayer(`Sequence Error. Expected "${gameState.chain[recallIndex]}".`);
      }
    } 
    else {
      const itemExists = currentTopicData.some(item => item.toLowerCase() === normalizedInput);
      const matchedItem = currentTopicData.find(item => item.toLowerCase() === normalizedInput) || targetValue.trim();
      
      if (!itemExists) {
        eliminatePlayer(`"${targetValue}" is not recognized in the ${TOPICS[gameState.topic].name} database.`);
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

  // Auto-focus input for human
  useEffect(() => {
    if (!isAITurn && gameState.status === 'playing') {
      inputRef.current?.focus();
    }
  }, [isAITurn, gameState.status, recallIndex]);

  // Mirror state in refs for async work (AI loop)
  const gameStateRef = useRef(gameState);
  const recallIndexRef = useRef(recallIndex);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { recallIndexRef.current = recallIndex; }, [recallIndex]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.75; // Slower, more natural cadence
      utterance.pitch = 0.9; 
      const voices = window.speechSynthesis.getVoices();
      // Prioritize natural sounding English voices
      const preferred = voices.find(v => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium')) && v.lang.startsWith('en')) 
                    || voices.find(v => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;
      window.speechSynthesis.speak(utterance);
    }
  };

  const nextTurn = useCallback((newItem: string) => {
    setGameState(prev => {
      let nextIndex = (prev.currentTurnIndex + 1) % prev.players.length;
      while (prev.players[nextIndex].isEliminated) {
        nextIndex = (nextIndex + 1) % prev.players.length;
      }
      
      const currentPlayerName = prev.players[prev.currentTurnIndex].name;
      setTopicLog(log => [{ item: newItem, player: currentPlayerName }, ...log]);

      return {
        ...prev,
        chain: [...prev.chain, newItem],
        currentTurnIndex: nextIndex,
      };
    });
    setRecallIndex(0);
    setCurrentInput('');
    showFeedback('success', `Node Linked: ${newItem}`);
  }, [showFeedback]);

  const eliminatePlayer = useCallback((reason: string) => {
    setGameState(prev => {
      const currentPlayerIndex = prev.currentTurnIndex;
      const playerToEliminate = prev.players[currentPlayerIndex];
      const updatedPlayers = prev.players.map(p => 
        p.id === playerToEliminate.id ? { ...p, isEliminated: true } : p
      );

      const activePlayers = updatedPlayers.filter(p => !p.isEliminated);
      
      if (activePlayers.length === 1) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
        return {
          ...prev,
          players: updatedPlayers,
          status: 'winner'
        };
      } else {
        let nextIndex = (currentPlayerIndex + 1) % prev.players.length;
        while (updatedPlayers[nextIndex].isEliminated) {
          nextIndex = (nextIndex + 1) % prev.players.length;
        }
        showFeedback('error', `${playerToEliminate.name} eliminated: ${reason}`);
        return {
          ...prev,
          players: updatedPlayers,
          currentTurnIndex: nextIndex,
          status: 'playing'
        };
      }
    });
    setRecallIndex(0);
    setCurrentInput('');
  }, [showFeedback]);

  // AI Turn Logic
  useEffect(() => {
    if (isAITurn && gameState.status === 'playing') {
      const playAI = async () => {
        const game = gameStateRef.current;
        
        // Step 1: Recall existing
        for (let i = 0; i < game.chain.length; i++) {
          const delay = 400 + Math.random() * 600;
          await new Promise(r => setTimeout(r, delay));
          const currentItem = game.chain[i];
          
          // Simulation of "typing" or "thinking"
          for (let charIdx = 1; charIdx <= currentItem.length; charIdx++) {
             setCurrentInput(currentItem.substring(0, charIdx));
             await new Promise(r => setTimeout(r, 20 + Math.random() * 50));
          }
          
          speak(currentItem);
          await new Promise(r => setTimeout(r, 600));
          setRecallIndex(i + 1);
          setCurrentInput('');
        }

        // Step 2: Add new
        await new Promise(r => setTimeout(r, 1000));
        const unusedItems = currentTopicData.filter(item => 
          !gameStateRef.current.chain.some(c => c.toLowerCase() === item.toLowerCase())
        );

        if (unusedItems.length === 0) {
           eliminatePlayer("Out of options in current domain.");
           return;
        }

        const randomIndex = Math.floor(Math.random() * unusedItems.length);
        const choice = unusedItems[randomIndex];
        
        // Typing simulation for new word
        for (let charIdx = 1; charIdx <= choice.length; charIdx++) {
           setCurrentInput(choice.substring(0, charIdx));
           await new Promise(r => setTimeout(r, 30 + Math.random() * 70));
        }

        speak(choice);
        await new Promise(r => setTimeout(r, 1200));
        
        // Use nextTurn directly to avoid state sync issues in recallIndex during AI turn
        nextTurn(choice);
      };

      playAI();
    }
  }, [isAITurn, gameState.status, gameState.currentTurnIndex, currentTopicData, nextTurn, eliminatePlayer]);


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
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-sky-500/30 overflow-x-hidden relative">
      {/* Background Neural Grid */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20" />
        {/* Distant Particles/Neurons */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
             <motion.div
               key={i}
               className="absolute w-1 h-1 bg-sky-500/20 rounded-full"
               animate={{ 
                 x: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
                 y: [Math.random() * 100 + '%', Math.random() * 100 + '%'],
                 opacity: [0, 0.5, 0]
               }}
               transition={{ duration: 10 + Math.random() * 20, repeat: Infinity, ease: "linear" }}
             />
          ))}
        </div>
      </div>

      {/* Header Accent */}
      <div className="fixed top-0 left-0 w-full h-1 bg-sky-500 z-50 shadow-[0_0_15px_rgba(14,165,233,0.5)]" />

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
                <div className="flex items-center gap-4">
                  <p className="text-sky-400 font-mono text-sm tracking-[0.3em] uppercase">Multi-Topic Neural Link Active</p>
                  <button 
                    onClick={() => setShowHowTo(true)}
                    className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-500 hover:text-sky-400 hover:border-sky-500 transition-all font-mono"
                  >
                    [HOW TO OPERATE]
                  </button>
                </div>
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
                <aside className="col-span-12 lg:col-span-3 flex flex-col gap-8 h-full max-h-[calc(100vh-20rem)]">
                  <div className="space-y-4">
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
                  </div>

                  {/* Sidebar empty space */}
                  <div className="flex-1" />
                </aside>

                {/* Main Chain Content */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="bg-sky-500 text-slate-950 px-2 py-0.5 text-xs font-black uppercase tracking-tighter">
                        Current Memory Trace
                      </span>
                      <h2 className="text-4xl font-bold mt-2 uppercase tracking-tighter flex items-center gap-4">
                        {isAITurn ? (
                          <>
                            <span className="text-sky-400">AI IS PROCESSING</span>
                            <span className="flex gap-1">
                              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.3 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.6 }} className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                            </span>
                          </>
                        ) : (
                          `Your Turn: Recall Sequence`
                        )}
                      </h2>
                    </div>
                  </div>

                  {/* Hidden Memory Interface - Neural Core */}
                  <div className="flex-1 bg-slate-900/10 rounded-[3rem] border-2 border-slate-900/50 p-12 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden group">
                    {/* SVG Filters for "Natural" Pulse */}
                    <svg className="absolute w-0 h-0">
                      <filter id="neural-glow">
                        <feGaussianBlur stdDeviation="15" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                      </filter>
                    </svg>

                    <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,#38bdf8_0,transparent_70%)] animate-pulse" />
                    </div>
                    
                    <div className="relative">
                      <motion.div 
                        animate={{ 
                          scale: [1, 1.1, 1],
                          rotate: [0, 90, 180, 270, 360],
                          opacity: [0.2, 0.4, 0.2] 
                        }}
                        transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                        className="w-64 h-64 rounded-full border-2 border-dashed border-sky-400/20 absolute -top-8 -left-8"
                      />
                      
                      <motion.div 
                        animate={{ 
                          scale: [1, 1.05, 1],
                          boxShadow: [
                            '0 0 40px rgba(56, 189, 248, 0.1)',
                            '0 0 80px rgba(56, 189, 248, 0.3)',
                            '0 0 40px rgba(56, 189, 248, 0.1)'
                          ]
                        }}
                        transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                        className="w-48 h-48 rounded-full bg-slate-950 border-4 border-slate-900 flex items-center justify-center relative z-10"
                        style={{ filter: 'url(#neural-glow)' }}
                      >
                        <div className="absolute inset-2 border border-sky-500/10 rounded-full animate-[spin_12s_linear_infinite]" />
                        <div className="absolute inset-4 border border-sky-500/20 rounded-full animate-[spin_8s_linear_infinite_reverse]" />
                        <Globe className={cn(
                          "w-16 h-16 transition-all duration-700",
                          isAITurn ? "text-sky-400 scale-110 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]" : "text-slate-800"
                        )} />
                      </motion.div>
                    </div>

                    <div className="mt-12 text-center space-y-4">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-[9px] uppercase tracking-[0.5em] text-sky-500/60 font-black">Neural Processor</span>
                        <h3 className="text-3xl font-black uppercase tracking-tighter text-slate-100 italic">Memory Buffer</h3>
                      </div>
                      
                      <div className="flex items-center justify-center gap-6 pt-4">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black uppercase mb-1 text-slate-500 tracking-widest">Active Node</span>
                          <motion.span 
                            key={recallIndex}
                            initial={{ scale: 1.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-5xl font-black text-sky-400 italic"
                          >
                            {String(recallIndex + 1).padStart(2, '0')}
                          </motion.span>
                        </div>
                        <div className="w-px h-12 bg-slate-800" />
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-black uppercase mb-1 text-slate-700 tracking-widest">Capacity</span>
                          <span className="text-5xl font-black text-slate-800 italic">{String(gameState.chain.length).padStart(2, '0')}</span>
                        </div>
                      </div>

                      {isAITurn && (
                        <motion.p 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="text-sky-400 font-mono text-[10px] tracking-[0.3em] uppercase pt-4"
                        >
                          Synthesizing Output...
                        </motion.p>
                      )}
                    </div>
                  </div>

                  {/* Input Interaction Area */}
                  <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                    <div className="flex-1 relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                        <Search className="w-5 h-5 text-slate-600" />
                      </div>
                      <input
                        ref={inputRef}
                        autoFocus
                        disabled={isAITurn}
                        type="text"
                        className={cn(
                          "w-full h-20 bg-slate-900 rounded-3xl border-2 border-slate-800 pl-16 pr-8 text-2xl font-black uppercase tracking-tighter outline-none focus:border-sky-500 transition-all placeholder:text-slate-800",
                          isAITurn && "opacity-50 grayscale"
                        )}
                        placeholder={recallIndex < gameState.chain.length ? `RECALL #${recallIndex + 1}...` : "APPEND NEW NODE..."}
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleInputSubmit()}
                      />
                      
                      {/* Suggestions Overlay */}
                      <AnimatePresence>
                        {suggestions.length > 0 && !isAITurn && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-[105%] left-0 w-full bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-20"
                          >
                            <div className="flex gap-1 p-2">
                              {suggestions.map((s, i) => (
                                <button
                                  key={s}
                                  onClick={() => {
                                    setCurrentInput(s);
                                    handleInputSubmit(undefined, s);
                                  }}
                                  className="flex-1 px-4 py-3 bg-slate-950 hover:bg-sky-500 hover:text-slate-950 text-sky-400 font-black uppercase tracking-tighter text-sm transition-all rounded-xl truncate"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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

      {/* HOW TO PLAY MODAL */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border-2 border-slate-800 p-10 rounded-[2.5rem] max-w-2xl w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowHowTo(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <Plus className="w-8 h-8 rotate-45" />
              </button>

              <h2 className="text-4xl font-black uppercase italic tracking-tighter mb-8">System Manual</h2>
              
              <div className="space-y-8 text-slate-400">
                <section>
                  <h3 className="text-sky-400 font-black uppercase tracking-widest text-xs mb-3">Objective</h3>
                  <p className="mb-4 text-sm leading-relaxed">
                    Neural Chain is a high-stakes cognitive memory game where players compete to build and recall an ever-growing sequence of items within specific domains. Designed with a sleek, minimalist cyberpunk aesthetic, the app challenges your brain to accurately replay the entire sequence before appending a new unique node, creating a tense battle of mental endurance against sophisticated AI units.
                  </p>
                  <p className="text-sm">Build a chain of items from the selected domain. Each player must repeat the ENTIRE sequence before adding a new item.</p>
                </section>

                <section>
                  <h3 className="text-sky-400 font-black uppercase tracking-widest text-xs mb-3">Turn Sequence</h3>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Recall: Enter items 1 to N of the current chain in order.</li>
                    <li>Append: Enter a NEW, unique item to grow the chain.</li>
                  </ol>
                </section>
              </div>

              <button 
                onClick={() => setShowHowTo(false)}
                className="mt-10 w-full bg-slate-50 text-slate-950 py-4 rounded-2xl font-black uppercase tracking-tighter hover:bg-white transition-all"
              >
                Acknowledge Protocol
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FEEDBACK TOAST */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-12 right-12 z-[100]"
          >
            <div className={cn(
              "px-8 py-4 rounded-2xl text-slate-950 font-black uppercase tracking-tighter text-lg shadow-2xl flex items-center gap-4 border-b-4",
              feedback.type === 'error' ? "bg-red-500 border-red-700" : "bg-sky-500 border-sky-700"
            )}>
              {feedback.type === 'error' ? <AlertCircle className="w-6 h-6" /> : <Trophy className="w-6 h-6" />}
              {feedback.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  );
}
