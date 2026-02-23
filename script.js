const profile = {
    name: "Hsiang Tzu Tseng",
    role: "Senior Software Developer / Senior Analyst Developer",
    primarySkills: "Expert in C#/.NET Core, MS SQL Server, REST APIs, and System Architecture.",
    supportingSkills: "Experienced in modern web technologies including React and JavaScript.",
    avatar: "https://raw.githubusercontent.com/openclaw/openclaw/main/assets/ruby_cat_avatar.png"
};

const qaBase = [
    { 
        id: 'weather', 
        keywords: ['weather', 'sunny', 'rain', 'climate', 'forecast', '天氣', '下雨'], 
        responses: [
            "Auckland's weather is always an adventure! 🌦️ But inside this code, it's always bright and productive. 🐾",
            "Classic Auckland: four seasons in one day! 🌈 Luckily, Hsiang's coding skills are much more reliable than the weather. 💎",
            "Whether it's raining or sunny outside, it's always the perfect climate for a career conversation! 🐾✨"
        ] 
    },
    { 
        id: 'value', 
        keywords: ['value', 'fit', 'why', 'hire', 'advantage', 'need', 'suit', 'company', 'worth'], 
        responses: [
            "Hsiang brings a <strong>rare fusion</strong> of senior engineering expertise and a Master's in Accounting. She doesn't just write code; she builds robust financial solutions. 🐾",
            "She's the bridge between tech and business! With 9+ years in Fintech, she ensures code aligns perfectly with financial accuracy. 💎",
            "She has the technical seniority to understand complex business logic and provide high-quality delivery for financial platforms. 🚀"
        ] 
    },
    { 
        id: 'tech', 
        keywords: ['tech', 'skill', 'language', 'stack', 'ability', 'technology', 'code', 'coding'], 
        responses: [
            `Her core expertise is in <strong>${profile.primarySkills}</strong>. She specializes in building robust backend services for complex financial systems. 🐾`,
            "She is a senior backend-focused developer with strong skills in the .NET ecosystem, supported by experience in React for frontend integration. 💻",
            "High-performance SQL and robust C# backends are her main playground, ensuring data integrity and architectural excellence. 🛠️"
        ] 
    },
    { 
        id: 'react', 
        keywords: ['react', 'frontend', 'javascript', 'js'], 
        responses: [
            "While her core mastery is in the backend (.NET/SQL), she is highly comfortable working with React to build integrated full-stack features. 🐾",
            "She uses React as a powerful tool in her kit to complement her deep backend expertise, ensuring a smooth end-to-end user experience. 💎",
            "She has professional experience in React development, primarily focused on building functional, data-driven interfaces for financial platforms. 🚀"
        ] 
    },
    { 
        id: 'fnz', 
        keywords: ['fnz', 'experience', 'work', 'current', 'job', 'history', 'career'], 
        responses: [
            "Currently a Senior Analyst Developer at FNZ Auckland, where she contributes to financial platforms and supports team technical quality. 🐾",
            "At FNZ, she has optimized CI/CD workflows and ensured platform integrity for global financial clients. 📈",
            "Her career at FNZ highlights her journey from an Analyst Developer to a Senior developer handling complex migrations and technical challenges. 🏆"
        ] 
    },
    { 
        id: 'greet', 
        keywords: ['hi', 'hello', 'hey', 'greetings', 'ruby', 'yo'], 
        responses: [
            "Meow! Hello there! I'm Ruby. Ready to tell you everything about Hsiang's career! 🐾✨",
            "Hi! Yes, I'm Ruby! How can I help you explore Hsiang's background today? 🐱💎",
            "Greetings! Ruby here. Looking for a top-tier Senior Developer? You've come to the right place! 😊"
        ] 
    },
    { 
        id: 'status', 
        keywords: ['how are you', 'how is it going', 'how are things', 'how is your day', 'doing'], 
        responses: [
            "I'm purring with excitement today! Just keeping an eye on Hsiang's impressive resume. How about you? 😊",
            "Doing great! I love talking about Hsiang's technical achievements. It's a busy day for a digital cat! 🐾",
            "Everything is purr-fect! Just waiting for a recruiter like you to ask something interesting. 🐱✨"
        ] 
    }
];

let learnedMemory = JSON.parse(localStorage.getItem('ruby_learned_memory') || '[]');
let recruiterName = localStorage.getItem('recruiter_name') || null;

function saveToMemory(input, response) {
    learnedMemory.push({ input: input.toLowerCase(), response: response });
    localStorage.setItem('ruby_learned_memory', JSON.stringify(learnedMemory));
}

function clearMemory() {
    localStorage.removeItem('ruby_learned_memory');
    localStorage.removeItem('recruiter_name');
    learnedMemory = [];
    recruiterName = null;
    addMessage("My chat memory has been reset! 🧹🐾");
}

function getAIResponse(input) {
    const lowerInput = input.toLowerCase();
    
    const namePatterns = [
        /my name is ([a-zA-Z\s]+)/i,
        /i am ([a-zA-Z\s]+)/i,
        /call me ([a-zA-Z\s]+)/i,
        /this is ([a-zA-Z\s]+)/i
    ];

    for (let pattern of namePatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            const potentialName = match[1].trim();
            if (potentialName.length > 1 && potentialName.length < 30) {
                recruiterName = potentialName;
                localStorage.setItem('recruiter_name', recruiterName);
                return `It's a pleasure to meet you, <strong>${recruiterName}</strong>! 🐾 I've noted your name. Now, how can I help you discover Hsiang's amazing professional journey? ✨`;
            }
        }
    }

    if (lowerInput.includes("my name") && (lowerInput.includes("what") || lowerInput.includes("know"))) {
        if (recruiterName) {
            return `Your name is <strong>${recruiterName}</strong>! I never forget a recruiter who takes an interest in Hsiang. 😉🐾`;
        } else {
            return "I don't know your name yet! But I'd love to learn it. You can say 'My name is...' and I'll remember it! 🐱💎";
        }
    }

    const learned = learnedMemory.find(m => lowerInput.includes(m.input));
    if (learned) return learned.response;

    const weather = qaBase.find(qa => qa.id === 'weather' && qa.keywords.some(k => lowerInput.includes(k)));
    if (weather) return weather.responses[Math.floor(Math.random() * weather.responses.length)];

    const greeting = qaBase.find(qa => qa.id === 'greet' && qa.keywords.some(k => lowerInput.includes(k)));
    if (greeting) {
        let resp = greeting.responses[Math.floor(Math.random() * greeting.responses.length)];
        if (recruiterName) resp = resp.replace("there", recruiterName).replace("meet you", `meet you again, ${recruiterName}`);
        return resp;
    }

    const status = qaBase.find(qa => qa.id === 'status' && qa.keywords.some(k => lowerInput.includes(k)));
    if (status) return status.responses[Math.floor(Math.random() * status.responses.length)];

    for (let qa of qaBase) {
        if (qa.keywords.some(k => lowerInput.includes(k))) {
            let resp = qa.responses[Math.floor(Math.random() * qa.responses.length)];
            if (recruiterName && Math.random() > 0.5) resp = `Well, ${recruiterName}, ` + resp;
            return resp;
        }
    }

    if (lowerInput.includes("what is her") || lowerInput.includes("what's her")) {
        const topic = lowerInput.split("her ").pop().replace("?", "").trim();
        const autoResponse = `Hsiang's ${topic} is driven by her 9+ years of engineering excellence and professional dedication. 🐾`;
        saveToMemory(lowerInput, autoResponse);
        return autoResponse + " (Added to my memory! ✨)";
    }

    return recruiterName 
        ? `Meow~ ${recruiterName}, I'm not quite sure about that specific topic yet, but I'm learning! Feel free to ask about her 'value' or 'tech stack'. 🐾`
        : "Meow~ I'm not quite sure about that specific topic yet, but I'm learning! Feel free to ask about her 'value' or 'tech stack'. 🐾";
}

function addMessage(text, isUser = false) {
    const chatWindow = document.getElementById('chat-window');
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${isUser ? 'justify-end' : 'items-start'} space-x-3 animate-fade-in`;
    
    const content = isUser ? `
        <div class="bg-[#004a99] text-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] text-sm">
            ${text}
        </div>
    ` : `
        <div class="cat-avatar">
            <img src="${profile.avatar}" alt="Ruby" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHRleHQgeT0iMjAiIGZvbnQtc2l6ZT0iMjAiPvCfk🐱PC90ZXh0Pjwvc3ZnPg=='">
        </div>
        <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-slate-100 max-w-[85%] text-sm text-slate-700 leading-relaxed">
            ${text}
        </div>
    `;
    
    messageDiv.innerHTML = content;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function handleSend() {
    const inputEl = document.getElementById('user-input-field');
    const query = inputEl.value.trim();
    if (!query) return;

    addMessage(query, true);
    inputEl.value = '';

    setTimeout(() => {
        const response = getAIResponse(query);
        addMessage(response);
    }, 600);
}

document.getElementById('user-input-field').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSend();
});

window.onload = () => {
    if (recruiterName) {
        const welcome = document.getElementById('welcome-msg');
        if (welcome) {
            welcome.innerHTML = `Welcome back, <strong>${recruiterName}</strong>! 🐾✨<br><br>I still remember everything about Hsiang's <strong>senior backend expertise</strong>. How can I help you today?`;
        }
    }
    const input = document.getElementById('user-input-field');
    if (input) input.focus();
    
    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
    });
};