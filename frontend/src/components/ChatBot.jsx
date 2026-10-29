import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const ChatBot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hey there! I'm FoodKey AI 🍽️ What are you craving today? I can recommend dishes based on your mood, dietary preferences, or cuisine type!" }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            const response = await axios.post(`${API}/chat`, {
                message: userMessage,
                session_id: sessionId
            });

            setSessionId(response.data.session_id);
            setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
        } catch (error) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: "Sorry, I'm having trouble right now. Try asking me about burgers, sushi, or healthy options!" 
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fab"
                data-testid="chatbot-fab"
                aria-label={isOpen ? 'Close chat' : 'Open chat'}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div className="chat-window" data-testid="chatbot-window">
                    {/* Header */}
                    <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-black/60">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                            <Bot size={20} className="text-black" />
                        </div>
                        <div>
                            <h3 className="font-semibold">FoodKey AI</h3>
                            <p className="text-xs text-muted-foreground">Your food recommendation buddy</p>
                        </div>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                        <div className="space-y-4">
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                                            <Bot size={16} className="text-primary" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                            msg.role === 'user'
                                                ? 'bg-primary text-black'
                                                : 'bg-secondary text-foreground'
                                        }`}
                                    >
                                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                            <User size={16} />
                                        </div>
                                    )}
                                </div>
                            ))}
                            {loading && (
                                <div className="flex gap-2 items-center">
                                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                        <Bot size={16} className="text-primary" />
                                    </div>
                                    <div className="bg-secondary rounded-2xl px-4 py-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-4 border-t border-white/10 bg-black/40">
                        <div className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Ask me anything about food..."
                                className="flex-1 bg-secondary/50 border-0"
                                disabled={loading}
                                data-testid="chat-input"
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!input.trim() || loading}
                                size="icon"
                                className="bg-primary text-black hover:bg-primary/90"
                                data-testid="chat-send-btn"
                            >
                                <Send size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ChatBot;
