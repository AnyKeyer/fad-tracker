// Vuex store for application state management
import Vue from 'vue';
import Vuex from 'vuex';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    // Analysis settings
    keywords: [],
    excludedTerms: [],
    isAnalysisRunning: false,
    
    // Statistics
    totalPosts: 0,
    filteredPosts: 0,
    posts: [], // Array to store post timestamps
    twitterSession: null,
    
    // UI state
    currentStep: 'main', // 'main', 'keywords', 'excludedTerms', 'monitoring'
  },
  
  mutations: {
    // Analysis settings mutations
    SET_KEYWORDS(state, keywords) {
      state.keywords = keywords;
    },
    
    ADD_KEYWORD(state, keyword) {
      if (!state.keywords.includes(keyword)) {
        state.keywords.push(keyword);
      }
    },
    
    REMOVE_KEYWORD(state, keyword) {
      const index = state.keywords.indexOf(keyword);
      if (index !== -1) {
        state.keywords.splice(index, 1);
      }
    },
    
    SET_EXCLUDED_TERMS(state, terms) {
      state.excludedTerms = terms;
    },
    
    ADD_EXCLUDED_TERM(state, term) {
      if (!state.excludedTerms.includes(term)) {
        state.excludedTerms.push(term);
      }
    },
    
    REMOVE_EXCLUDED_TERM(state, term) {
      const index = state.excludedTerms.indexOf(term);
      if (index !== -1) {
        state.excludedTerms.splice(index, 1);
      }
    },
    
    SET_ANALYSIS_RUNNING(state, isRunning) {
      state.isAnalysisRunning = isRunning;
    },
    
    // Statistics mutations
    ADD_POST(state, timestamp) {
      state.totalPosts++;
      state.posts.push(timestamp);
    },
    
    ADD_FILTERED_POST(state) {
      state.filteredPosts++;
    },
    
    CLEAR_STATS(state) {
      state.totalPosts = 0;
      state.filteredPosts = 0;
      state.posts = [];
    },
    
    SET_TWITTER_SESSION(state, session) {
      state.twitterSession = session;
    },
    
    // UI state mutations
    SET_CURRENT_STEP(state, step) {
      state.currentStep = step;
    }
  },
  
  actions: {
    // Start analysis
    async startAnalysis({ commit, state }) {
      try {
        // Clear previous stats
        commit('CLEAR_STATS');
        
        // Set analysis running
        commit('SET_ANALYSIS_RUNNING', true);
        
        // Call the Electron API to start the analysis
        const result = await window.api.startAnalysis({
          keywords: state.keywords,
          excludedTerms: state.excludedTerms
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to start analysis');
        }
        
        return true;
      } catch (error) {
        console.error('Error starting analysis:', error);
        commit('SET_ANALYSIS_RUNNING', false);
        throw error;
      }
    },
    
    // Stop analysis
    async stopAnalysis({ commit }) {
      try {
        const result = await window.api.stopAnalysis();
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to stop analysis');
        }
        
        commit('SET_ANALYSIS_RUNNING', false);
        return true;
      } catch (error) {
        console.error('Error stopping analysis:', error);
        throw error;
      }
    },
    
    // Save Twitter session
    async saveTwitterSession({ commit }) {
      try {
        const result = await window.api.saveTwitterSession();
        
        if (result.success) {
          commit('SET_TWITTER_SESSION', true);
        }
        
        return result;
      } catch (error) {
        console.error('Error saving Twitter session:', error);
        throw error;
      }
    }
  },
  
  getters: {
    // Get posts in a specific time range
    getPostsInTimeRange: (state) => (minutes) => {
      const now = Date.now();
      const cutoff = now - (minutes * 60 * 1000);
      
      return state.posts.filter(timestamp => timestamp >= cutoff).length;
    },
    
    // Get keywords as a formatted search string
    getSearchQuery: (state) => {
      return state.keywords.join(' OR ');
    },
    
    // Check if keyword exists
    hasKeyword: (state) => (keyword) => {
      return state.keywords.includes(keyword);
    },
    
    // Check if excluded term exists
    hasExcludedTerm: (state) => (term) => {
      return state.excludedTerms.includes(term);
    }
  }
});