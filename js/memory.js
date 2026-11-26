import { APP_CONFIG } from './config.js';

/**
 * Encapsulates persistent browser memory (recruiter name & custom notes)
 * and in-session conversation state.
 */
export class ConversationMemory {
    constructor(storage = globalThis.localStorage) {
        this.storage = storage || null;
        this.recruiterName = this._readString(APP_CONFIG.storageKeys.recruiterName);
        this.customNotes = this._readJson(APP_CONFIG.storageKeys.customNotes, {});
        this.messages = [];
        this.discussedDocIds = new Set();
    }

    _readString(key) {
        try {
            return this.storage ? this.storage.getItem(key) : null;
        } catch {
            return null;
        }
    }

    _readJson(key, fallback) {
        try {
            const raw = this.storage ? this.storage.getItem(key) : null;
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    _write(key, value) {
        try {
            if (this.storage) {
                this.storage.setItem(key, value);
            }
        } catch {
            // Ignore storage quota / private-mode errors gracefully
        }
    }

    setRecruiterName(name) {
        this.recruiterName = name;
        this._write(APP_CONFIG.storageKeys.recruiterName, name);
    }

    getRecruiterName() {
        return this.recruiterName;
    }

    rememberNote(subject, fact) {
        const cleanSubject = subject.trim();
        const cleanFact = fact.trim();
        if (!cleanSubject || !cleanFact) return false;
        this.customNotes[cleanSubject] = cleanFact;
        this._write(APP_CONFIG.storageKeys.customNotes, JSON.stringify(this.customNotes));
        return true;
    }

    findMatchingNote(query) {
        const q = query.toLowerCase();
        for (const [subject, fact] of Object.entries(this.customNotes)) {
            if (q.includes(subject.toLowerCase())) {
                return { subject, fact };
            }
        }
        return null;
    }

    addTurn(role, text, docIds = []) {
        this.messages.push({ role, text, timestamp: Date.now() });
        if (this.messages.length > APP_CONFIG.maxHistoryTurns * 2) {
            this.messages = this.messages.slice(-APP_CONFIG.maxHistoryTurns * 2);
        }
        for (const id of docIds) {
            this.discussedDocIds.add(id);
        }
    }

    getRecentMessages() {
        return this.messages.slice(-APP_CONFIG.maxHistoryTurns);
    }

    hasDiscussed(docId) {
        return this.discussedDocIds.has(docId);
    }

    clear() {
        this.recruiterName = null;
        this.customNotes = {};
        this.messages = [];
        this.discussedDocIds.clear();
        try {
            if (this.storage) {
                this.storage.removeItem(APP_CONFIG.storageKeys.recruiterName);
                this.storage.removeItem(APP_CONFIG.storageKeys.customNotes);
                // Clean up legacy keys from v1
                this.storage.removeItem('recruiter_name');
                this.storage.removeItem('ruby_long_term_memory');
            }
        } catch {
            // Ignore storage errors
        }
    }
}
