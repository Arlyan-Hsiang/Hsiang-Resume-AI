const profile = {
    name: "Hsiang Tzu Tseng",
    role: "Senior Software Developer",
    expertise: "Senior Backend Specialist in C#/.NET Core and SQL Server, with experience in React.",
    value: "Rare combination of 9+ years senior engineering and a Master of Management specialized in Accounting, bridging the gap between complex financial logic and robust code.",
    background: "Currently Senior Analyst Developer at FNZ Auckland, previously worked at Cybersoft and PSA. Master's from UoA."
};

const intentMap = [
    { 
        id: 'tech', 
        semantics: ['expertise', 'skill', 'tech', 'stack', 'know', 'language', 'code', 'coding', 'experience', 'background', 'work', 'mastery', 'profile', 'software', 'developer'], 
        responses: [
            `Hsiang is a senior developer specializing in <strong>C#/.NET Core and MS SQL Server</strong>. She focuses on building high-performance financial systems. 🐾`,
            "She combines deep backend expertise with a strong understanding of financial business logic, making her a unique asset for Fintech platforms. 💻"
        ]
    },
    { 
        id: 'edu', 
        semantics: ['education', 'school', 'university', 'master', 'degree', 'qualification', 'study', 'academic'], 
        responses: [
            "Hsiang holds a <strong>Master of Management specialized in Accounting</strong> from the University of Auckland. This gives her a sophisticated understanding of business operations and financial logic. 🎓",
            "She completed her Master of Management at UoA, with a specific focus on Accounting. This academic background perfectly complements her technical seniority in Fintech. 🐾"
        ]
    },
    { 
        id: 'value', 
        semantics: ['value', 'values', 'fit', 'why', 'hire', 'good', 'reason', 'advantage', 'better', 'special', 'worth', 'benefit', 'suit'], 
        responses: [
            "Hsiang brings a rare fusion of senior engineering expertise and a Master's in Accounting. She builds robust financial solutions that make sense for the business. 🐾",
            "She's the bridge between tech and finance! With 9+ years in the industry, she ensures every line of code aligns with financial accuracy. 💎"
        ]
    },
    { 
        id: 'weather', 
        semantics: ['weather', 'sunny', 'rain', 'climate', 'forecast', 'outside', 'temperature'], 
        responses: [
            "Auckland's weather is always an adventure! 🌦️ But inside this chat, it's always purr-fectly productive. 🐾",
            "Classical Auckland: four seasons in one day! Luckily, Hsiang's code is much more stable than the clouds. 💎"
        ]
    },
    { 
        id: 'greet', 
        semantics: ['hi', 'hello', 'hey', 'yo', 'greetings', 'ruby'], 
        responses: [
            "Meow! Hello! I'm Ruby. Ready to tell you everything about Hsiang's career. What's on your mind? 🐾✨",
            "Hi there! Yes, I'm Ruby. How can I help you explore her background today? 🐱💎"
        ]
    },
    { 
        id: 'status', 
        semantics: ['how are you', 'how is it going', 'how are things', 'how is your day'], 
        responses: [
            "I'm purring with excitement! Just keeping an eye on this impressive resume. How about you? 😊",
            "Doing great! I love talking about Hsiang's achievements. It's a busy day for a digital cat! 🐾"
        ]
    }
];

let recruiterName = localStorage.getItem('recruiter_name') || null;
let longTermMemory = JSON.parse(localStorage.getItem('ruby_long_term_memory') || '{}');
let chatHistory = []; // Local session history

function getIntent(input) {
    const inputLower = input.toLowerCase().trim();
    const tokens = inputLower.split(/[\s,?.!]+/).filter(t => t.length > 2);
    
    // Check context for "Anything else" or "Tell me more"
    if (inputLower.includes("anything else") || inputLower.includes("what else") || inputLower.includes("tell me more") || inputLower.includes("more")) {
        // If they ask "more", look at what was last discussed
        const lastIntent = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].intentId : null;
        if (lastIntent === 'tech') return 'edu'; // If we talked tech, tell about education
        if (lastIntent === 'edu') return 'value'; // If we talked edu, tell about value
        return 'more'; // Random highlight
    }

    if (inputLower.includes("education") || inputLower.includes("degree") || inputLower.includes("study")) return 'edu';
    if (inputLower.includes("tell me about") || inputLower.includes("who is") || inputLower.includes("profile")) return 'tech';

    let bestMatch = { id: null, score: 0 };
    for (let intent of intentMap) {
        if (intent.id === 'weather' && !tokens.some(t => ['weather', 'sunny', 'rain'].includes(t))) continue;

        let score = tokens.filter(t => 
            intent.semantics.includes(t) || 
            intent.semantics.some(s => t.startsWith(s) && t.length <= s.length + 1)
        ).length;
        
        if (intent.id === 'edu') score *= 2.0; 
        if (intent.id === 'tech' || intent.id === 'value') score *= 1.2;

        if (score > bestMatch.score) {
            bestMatch = { id: intent.id, score: score };
        }
    }

    return (bestMatch.score >= 1.0) ? bestMatch.id : null;
}

function getAIResponse(input) {
    const lowerInput = input.toLowerCase().trim();

    // Contextual Learning
    if (lowerInput.includes("remember that") && lowerInput.includes("is")) {
        const part = lowerInput.split("remember that")[1].trim();
        const [subject, ...factParts] = part.split(" is ");
        const fact = factParts.join(" is ").replace(/[?.!]/g, "");
        if (subject && fact) {
            longTermMemory[subject.trim()] = fact.trim();
            localStorage.setItem('ruby_long_term_memory', JSON.stringify(longTermMemory));
            return `Stored! <strong>${subject}</strong> is <strong>${fact}</strong>. 🧠✨`;
        }
    }

    // Name Recognition
    const nameIntros = ["my name is ", "i am ", "call me ", "i'm "];
    for (let intro of nameIntros) {
        if (lowerInput.includes(intro)) {
            let namePart = lowerInput.split(intro)[1].trim();
            let name = namePart.split(" ")[0].replace(/[^a-zA-Z]/g, "");
            if (name.length > 1) {
                const commonWords = ["how", "what", "is", "not", "the"];
                if (!commonWords.includes(name)) {
                    recruiterName = name.charAt(0).toUpperCase() + name.slice(1);
                    localStorage.setItem('recruiter_name', recruiterName);
                    return `Nice to meet you, <strong>${recruiterName}</strong>! 🐾 How can I help you explore Hsiang's journey?`;
                }
            }
        }
    }

    // Recall Memory
    for (let key in longTermMemory) {
        if (lowerInput.includes(key.toLowerCase())) {
            return `Recalling my notes: ${key} is ${longTermMemory[key]} 🐱🧠`;
        }
    }

    const intentId = getIntent(input);
    
    // History Tracking
    chatHistory.push({ input: lowerInput, intentId: intentId });

    if (intentId === 'more') {
        const choices = [
            "Did you know Hsiang has a <strong>Master of Management</strong>? It really helps her understand the 'why' behind financial software. 🎓",
            "She's also an expert in <strong>CI/CD and TDD</strong>. She's all about high-quality, reliable code! 💎",
            "Besides tech, she has 9+ years in the industry, including major migrations and API developments. 🚀"
        ];
        return "Of course! " + choices[Math.floor(Math.random() * choices.length)];
    }

    if (intentId) {
        const intent = intentMap.find(i => i.id === intentId);
        let resp = intent.responses[Math.floor(Math.random() * intent.responses.length)];
        if (recruiterName && Math.random() > 0.4) resp = `${recruiterName}, ` + resp;
        return resp;
    }

    // Default Fallback
    return recruiterName 
        ? `Meow~ ${recruiterName}, I'm not entirely sure about that. Try asking about her <strong>technical stack</strong>, <strong>values</strong>, or <strong>education</strong>! 🐾`
        : "Meow! I'm still learning. Please ask me about Hsiang's <strong>background</strong>, <strong>skills</strong>, or <strong>values</strong>! 🐾";
}

function addMessage(text, isUser = false) {
    const chatWindow = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = `flex ${isUser ? 'justify-end' : 'items-start'} space-x-3 animate-fade-in`;
    div.innerHTML = isUser ? `
        <div class="bg-[#004a99] text-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-sm">${text}</div>
    ` : `
        <div class="cat-avatar">🐱</div>
        <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[85%] text-sm text-slate-700 leading-relaxed">${text}</div>
    `;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function handleSend() {
    const inputEl = document.getElementById('user-input-field');
    const query = inputEl.value.trim();
    if (!query) return;
    addMessage(query, true);
    inputEl.value = '';
    setTimeout(() => addMessage(getAIResponse(query)), 600);
}

function clearMemory() {
    localStorage.clear();
    location.reload();
}

window.onload = () => {
    if (recruiterName) {
        document.getElementById('welcome-msg').innerHTML = `Welcome back, <strong>${recruiterName}</strong>! 🐾✨<br><br>I'm Ruby, ready to discuss Hsiang's <strong>senior expertise</strong>. How can I help you?`;
    }
    const input = document.getElementById('user-input-field');
    input.focus();
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
};