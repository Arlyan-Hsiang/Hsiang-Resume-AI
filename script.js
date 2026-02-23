const profile = {
    name: "Hsiang Tzu Tseng",
    role: "Senior Software Developer",
    expertise: "Senior Backend Specialist in C#/.NET Core and SQL Server, with experience in React.",
    value: "Rare combination of 9+ years senior engineering and a Master's in Accounting, bridging the gap between complex financial logic and robust code.",
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
        id: 'value', 
        semantics: ['value', 'why', 'hire', 'fit', 'good', 'reason', 'advantage', 'better', 'special', 'worth', 'benefit', 'suit'], 
        responses: [
            "Hsiang brings a rare fusion of senior engineering expertise and a Master's in Accounting. She builds robust financial solutions that make sense for the business. 🐾",
            "She's the bridge between tech and finance! With 9+ years in the industry, she ensures every line of code aligns with financial accuracy. 💎"
        ]
    },
    { 
        id: 'weather', 
        semantics: ['weather', 'sunny', 'rain', 'climate', 'forecast', 'outside', 'temperature'], 
        responses: [
            "Auckland's weather is always a surprise! 🌦️ But inside this chat, it's always purr-fectly productive. 🐾",
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

function getIntent(input) {
    const inputLower = input.toLowerCase().trim();
    const tokens = inputLower.split(/[\s,?.!]+/).filter(t => t.length > 2);
    
    // STRICT CHECK: Only trigger weather if explicit weather keywords exist
    const weatherKeywords = ['weather', 'sunny', 'rain', 'forecast', 'climate', 'temperature'];
    const hasWeatherTerm = tokens.some(t => weatherKeywords.includes(t));
    
    // HARD RULES for specific phrases
    if (inputLower.includes("tell me about") || inputLower.includes("who is") || inputLower.includes("profile")) {
        return 'tech';
    }

    let bestMatch = { id: null, score: 0 };
    for (let intent of intentMap) {
        // Prevent accidental weather triggers
        if (intent.id === 'weather' && !hasWeatherTerm) continue;

        let score = tokens.filter(t => intent.semantics.includes(t)).length;
        
        // Boost professional intents
        if (intent.id === 'tech' || intent.id === 'value') score *= 1.5;

        if (score > bestMatch.score) {
            bestMatch = { id: intent.id, score: score };
        }
    }

    // REQUIRE CONFIDENCE: If score is too low, we don't guess
    return (bestMatch.score >= 1.0) ? bestMatch.id : null;
}

function getAIResponse(input) {
    const lowerInput = input.toLowerCase().trim();

    // 1. Long-term Memory recall
    for (let key in longTermMemory) {
        if (lowerInput.includes(key.toLowerCase())) {
            return `Memory recalled: About ${key}, ${longTermMemory[key]} 🐱🧠`;
        }
    }

    // 2. Learning Mechanism
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

    // 3. Name Recognition
    const nameIntros = ["my name is ", "i am ", "call me ", "i'm "];
    for (let intro of nameIntros) {
        if (lowerInput.includes(intro)) {
            let namePart = lowerInput.split(intro)[1].trim();
            let name = namePart.split(" ")[0].replace(/[^a-zA-Z]/g, "");
            if (name.length > 1) {
                // Ensure name isn't a common word like "how"
                const commonWords = ["how", "what", "is", "not", "the"];
                if (!commonWords.includes(name)) {
                    recruiterName = name.charAt(0).toUpperCase() + name.slice(1);
                    localStorage.setItem('recruiter_name', recruiterName);
                    return `Nice to meet you, <strong>${recruiterName}</strong>! 🐾 How can I help you explore Hsiang's journey?`;
                }
            }
        }
    }

    // 4. Intent Matching
    const intentId = getIntent(input);
    if (intentId) {
        const intent = intentMap.find(i => i.id === intentId);
        let resp = intent.responses[Math.floor(Math.random() * intent.responses.length)];
        if (recruiterName && Math.random() > 0.4) resp = `${recruiterName}, ` + resp;
        return resp;
    }

    // 5. UNCERTAINTY FALLBACK (Better to admit ignorance than guess wrong)
    return recruiterName 
        ? `Meow~ ${recruiterName}, I'm not entirely sure what you mean by that. Could you ask me about Hsiang's <strong>tech stack</strong>, <strong>experience</strong>, or <strong>why she's a great fit</strong>? 🐾`
        : "Meow! I'm still learning and I don't want to give you a wrong answer. Please ask me about Hsiang's <strong>background</strong>, <strong>skills</strong>, or <strong>value</strong>! 🐾";
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