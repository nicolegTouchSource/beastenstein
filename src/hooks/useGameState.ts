import { useState, useEffect, useCallback } from 'react';
import type { IndividualBeastData } from '../types/game';
import type { BeastPartInventory } from '../types/inventory';
import type { InventoryItem } from '../types/inventory';
import type { GameOptions } from '../types/options';
import { BeastManager } from '../services/BeastManager';
import { DEFAULT_OPTIONS } from '../types/options';
import { DEFAULT_ITEMS } from '../types/inventory';

// Adventure progress interface
export interface AdventureProgress {
  currentLevel: number;
  unlockedLevels: number[];
  completedLevels: number[];
  victories: number;
  defeats: number;
}

// Unified game state interface
export interface GameState {
  beasts: Record<string, IndividualBeastData>;
  currentBeastId: string;
  beastPartInventory: BeastPartInventory;
  inventoryItems: InventoryItem[];
  gameOptions: GameOptions;
  adventureProgress: AdventureProgress;
  beastOrder: string[];
  beastNames: Record<string, string>; // beastId -> name mapping
  customBeasts: Record<string, unknown>; // beastId -> custom beast configuration
  hasPlayedBefore: boolean;
}

// Storage keys used by the game
const STORAGE_KEYS = {
  BEAST_DATA: 'beastData',
  BEAST_PART_INVENTORY: 'beastPartInventory', 
  INVENTORY_ITEMS: 'inventoryItems',
  GAME_OPTIONS: 'gameOptions',
  ADVENTURE_PROGRESS: 'adventureProgress',
  BEAST_ORDER: 'beastOrder',
  BEAST_NAMES: 'beastNames',
  CUSTOM_BEASTS: 'customBeasts',
  HAS_PLAYED_BEFORE: 'hasPlayedBefore',
  CURRENT_BEAST_ID: 'currentBeastId'
} as const;

// Default values
const DEFAULT_ADVENTURE_PROGRESS: AdventureProgress = {
  currentLevel: 1,
  unlockedLevels: [1],
  completedLevels: [],
  victories: 0,
  defeats: 0
};

const DEFAULT_BEAST_PART_INVENTORY: BeastPartInventory = {
  parts: {
    'nightwolf-head': 2,
    'nightwolf-torso': 2,
    'mountaindragon-head': 1,
    'mountaindragon-torso': 1,
    'woodenpuppet-head': 1,
    'woodenpuppet-torso': 1,
    'forestsprite-head': 1,
    'forestsprite-torso': 1,
    'shadowbeast-head': 1,
    'shadowbeast-torso': 1,
    'thundereagle-head': 1,
    'thundereagle-torso': 1,
    'frostwolf-head': 1,
    'frostwolf-torso': 1,
    'nightwolf-extra-tail': 1,
    'mountaindragon-extra-wings': 1,
    'mountaindragon-extra-tail': 1
  },
  sets: {
    'nightwolf-arms': 2,
    'nightwolf-legs': 2,
    'mountaindragon-arms': 1,
    'mountaindragon-legs': 1,
    'woodenpuppet-arms': 1,
    'woodenpuppet-legs': 1,
    'forestsprite-arms': 1,
    'forestsprite-legs': 1,
    'shadowbeast-arms': 1,
    'shadowbeast-legs': 1,
    'thundereagle-arms': 1,
    'thundereagle-legs': 1,
    'frostwolf-arms': 1,
    'frostwolf-legs': 1
  },
  soulEssences: {
    'dim-soul': 3,
    'bright-soul': 2,
    'glowing-soul': 1,
    'brilliant-soul': 0,
    'luminescent-soul': 0
  }
};

/**
 * Central game state manager hook
 * Provides unified access to all game state and localStorage operations
 */
export function useGameState() {
  // Initialize state from localStorage
  const [gameState, setGameState] = useState<GameState>(() => {
    return loadGameState();
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveGameState(gameState);
  }, [gameState]);

  // Utility functions
  const updateBeasts = useCallback((updater: (beasts: Record<string, IndividualBeastData>) => Record<string, IndividualBeastData>) => {
    setGameState(prev => ({
      ...prev,
      beasts: updater(prev.beasts)
    }));
  }, []);

  const updateCurrentBeastId = useCallback((beastId: string) => {
    setGameState(prev => ({
      ...prev,
      currentBeastId: beastId
    }));
  }, []);

  const updateBeastPartInventory = useCallback((updater: (inventory: BeastPartInventory) => BeastPartInventory) => {
    setGameState(prev => ({
      ...prev,
      beastPartInventory: updater(prev.beastPartInventory)
    }));
  }, []);

  const updateInventoryItems = useCallback((updater: (items: InventoryItem[]) => InventoryItem[]) => {
    setGameState(prev => ({
      ...prev,
      inventoryItems: updater(prev.inventoryItems)
    }));
  }, []);

  const updateGameOptions = useCallback((updater: (options: GameOptions) => GameOptions) => {
    setGameState(prev => ({
      ...prev,
      gameOptions: updater(prev.gameOptions)
    }));
  }, []);

  const updateAdventureProgress = useCallback((updater: (progress: AdventureProgress) => AdventureProgress) => {
    setGameState(prev => ({
      ...prev,
      adventureProgress: updater(prev.adventureProgress)
    }));
  }, []);

  const updateBeastOrder = useCallback((order: string[]) => {
    setGameState(prev => ({
      ...prev,
      beastOrder: order
    }));
  }, []);

  const updateBeastName = useCallback((beastId: string, name: string) => {
    setGameState(prev => ({
      ...prev,
      beastNames: {
        ...prev.beastNames,
        [beastId]: name
      }
    }));
  }, []);

  const updateCustomBeast = useCallback((beastId: string, customBeastData: unknown) => {
    setGameState(prev => ({
      ...prev,
      customBeasts: {
        ...prev.customBeasts,
        [beastId]: customBeastData
      }
    }));
  }, []);

  const markHasPlayedBefore = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      hasPlayedBefore: true
    }));
  }, []);

  // Beast-specific operations
  const addBeast = useCallback((beastId: string, beastData: IndividualBeastData) => {
    updateBeasts(beasts => ({
      ...beasts,
      [beastId]: beastData
    }));
  }, [updateBeasts]);

  const removeBeast = useCallback((beastId: string) => {
    updateBeasts(beasts => {
      const newBeasts = { ...beasts };
      delete newBeasts[beastId];
      return newBeasts;
    });
  }, [updateBeasts]);

  const updateBeast = useCallback((beastId: string, updater: (beast: IndividualBeastData) => IndividualBeastData) => {
    updateBeasts(beasts => ({
      ...beasts,
      [beastId]: updater(beasts[beastId])
    }));
  }, [updateBeasts]);

  const updateBeastExperience = useCallback((beastId: string, newExperience: number) => {
    updateBeast(beastId, beast => ({
      ...beast,
      experience: newExperience
    }));
  }, [updateBeast]);

  // Reset all game data
  const resetGameState = useCallback(() => {
    // Clear all localStorage
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear legacy keys
    const legacyKeys = [
      'beastPartInventory', 'inventoryItems', 'gameOptions', 
      'adventureProgress', 'beastOrder', 'hasPlayedBefore'
    ];
    legacyKeys.forEach(key => localStorage.removeItem(key));
    
    // Clear beast-specific keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('beastData_') || key.startsWith('customBeast_') || key.startsWith('beastName_'))) {
        localStorage.removeItem(key);
      }
    }
    
    // Reset to initial state
    const newState = loadGameState();
    setGameState(newState);
  }, []);

  return {
    // State
    gameState,
    
    // Beast operations
    beasts: gameState.beasts,
    currentBeastId: gameState.currentBeastId,
    addBeast,
    removeBeast,
    updateBeast,
    updateBeastExperience,
    updateCurrentBeastId,
    
    // Inventory operations
    beastPartInventory: gameState.beastPartInventory,
    inventoryItems: gameState.inventoryItems,
    updateBeastPartInventory,
    updateInventoryItems,
    
    // Settings
    gameOptions: gameState.gameOptions,
    updateGameOptions,
    
    // Adventure
    adventureProgress: gameState.adventureProgress,
    updateAdventureProgress,
    
    // Beast order
    beastOrder: gameState.beastOrder,
    updateBeastOrder,
    
    // Beast names
    beastNames: gameState.beastNames,
    updateBeastName,
    
    // Custom beasts
    customBeasts: gameState.customBeasts,
    updateCustomBeast,
    
    // Global flags
    hasPlayedBefore: gameState.hasPlayedBefore,
    markHasPlayedBefore,
    
    // Utilities
    resetGameState
  };
}

/**
 * Migrate beast names from individual localStorage keys to centralized state
 */
function migrateBeastNames(): Record<string, string> {
  // First try to load from centralized storage
  const existingNames = loadFromStorage(STORAGE_KEYS.BEAST_NAMES, {});
  
  // If we already have centralized names AND they're not empty, return them
  if (Object.keys(existingNames).length > 0) {
    return existingNames;
  }
  
  // Otherwise, migrate from old localStorage format (even if centralized storage exists but is empty)
  const migratedNames: Record<string, string> = {};
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('beastName_')) {
      const beastId = key.replace('beastName_', '');
      const name = localStorage.getItem(key);
      console.log(`MIGRATION: Found legacy beast name - key: ${key}, beastId: ${beastId}, name: ${name}`);
      if (name) {
        migratedNames[beastId] = name;
        keysToRemove.push(key);
      }
    }
  }
  
  console.log('MIGRATION: Migrated names:', migratedNames);
  
  // Save migrated names to centralized storage
  if (Object.keys(migratedNames).length > 0) {
    console.log('MIGRATION: Saving migrated names to centralized storage');
    saveToStorage(STORAGE_KEYS.BEAST_NAMES, migratedNames);
    // Clean up old format
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return migratedNames;
  }
  
  // Return existing (even if empty) if no migration was needed
  return existingNames;
}

/**
 * Migrate custom beast data from individual localStorage keys to centralized state
 */
function migrateCustomBeasts(): Record<string, unknown> {
  console.log('MIGRATION: Starting custom beasts migration...');
  
  // First try to load from centralized storage
  const existingCustomBeasts = loadFromStorage(STORAGE_KEYS.CUSTOM_BEASTS, {});
  console.log('MIGRATION: Existing custom beasts from centralized storage:', existingCustomBeasts);
  
  // If we already have centralized custom beasts AND they're not empty, return them
  if (Object.keys(existingCustomBeasts).length > 0) {
    console.log('MIGRATION: Found existing centralized custom beasts, returning them');
    return existingCustomBeasts;
  }
  
  // Otherwise, migrate from old localStorage format (even if centralized storage exists but is empty)
  const migratedCustomBeasts: Record<string, unknown> = {};
  const keysToRemove: string[] = [];
  
  console.log('MIGRATION: Checking localStorage for legacy custom beasts...');
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('customBeast_')) {
      const beastId = key.replace('customBeast_', '');
      const customBeastDataString = localStorage.getItem(key);
      console.log(`MIGRATION: Found legacy custom beast - key: ${key}, beastId: ${beastId}, data: ${customBeastDataString?.substring(0, 100)}...`);
      if (customBeastDataString) {
        try {
          const customBeastData = JSON.parse(customBeastDataString);
          migratedCustomBeasts[beastId] = customBeastData;
          keysToRemove.push(key);
          console.log(`MIGRATION: Successfully parsed custom beast ${beastId}:`, customBeastData);
        } catch (error) {
          console.warn(`Failed to parse custom beast data for ${beastId}:`, error);
          // Keep the corrupted key for manual cleanup
        }
      }
    }
  }
  
  console.log('MIGRATION: Migrated custom beasts:', migratedCustomBeasts);
  
  // Save migrated custom beasts to centralized storage
  if (Object.keys(migratedCustomBeasts).length > 0) {
    console.log('MIGRATION: Saving migrated custom beasts to centralized storage');
    saveToStorage(STORAGE_KEYS.CUSTOM_BEASTS, migratedCustomBeasts);
    // Clean up old format
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return migratedCustomBeasts;
  }
  
  // Return existing (even if empty) if no migration was needed
  return existingCustomBeasts;
}

/**
 * Load complete game state from localStorage
 */
function loadGameState(): GameState {
  // Load beasts using BeastManager
  const beasts = BeastManager.loadBeastData();
  
  // Load current beast ID
  const currentBeastId = BeastManager.getFirstBeastId(beasts);
  
  // Load beast part inventory
  const beastPartInventory = loadFromStorage(
    STORAGE_KEYS.BEAST_PART_INVENTORY,
    DEFAULT_BEAST_PART_INVENTORY
  );
  
  // Load inventory items
  const inventoryItems = loadFromStorage(
    STORAGE_KEYS.INVENTORY_ITEMS,
    DEFAULT_ITEMS
  );
  
  // Load game options
  const gameOptions = loadFromStorage(
    STORAGE_KEYS.GAME_OPTIONS,
    DEFAULT_OPTIONS
  );
  
  // Load adventure progress
  const adventureProgress = loadFromStorage(
    STORAGE_KEYS.ADVENTURE_PROGRESS,
    DEFAULT_ADVENTURE_PROGRESS
  );
  
  // Load beast order
  const beastOrder = loadFromStorage(
    STORAGE_KEYS.BEAST_ORDER,
    Object.keys(beasts)
  );
  
  // Load has played before flag
  const hasPlayedBefore = localStorage.getItem(STORAGE_KEYS.HAS_PLAYED_BEFORE) === 'true';
  
  // Load and migrate beast names
  console.log('INITIALIZATION: Loading beast names...');
  const beastNames = migrateBeastNames();
  console.log('INITIALIZATION: Final beast names:', beastNames);
  
  // Load and migrate custom beast data
  console.log('INITIALIZATION: Loading custom beasts...');
  const customBeasts = migrateCustomBeasts();
  console.log('INITIALIZATION: Final custom beasts:', customBeasts);
  
  // Temporary debug function for forcing migration
  (window as unknown as { forceMigration?: () => void }).forceMigration = () => {
    console.log('FORCE MIGRATION: Clearing centralized storage...');
    localStorage.removeItem('customBeasts');
    localStorage.removeItem('beastNames');
    console.log('FORCE MIGRATION: Please refresh the page to trigger migration');
  };
  
  // Debug function to inspect all localStorage
  (window as unknown as { debugStorage?: () => void }).debugStorage = () => {
    console.log('=== STORAGE DEBUG ===');
    console.log('All localStorage keys:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`${key}:`, value?.substring(0, 200) + (value && value.length > 200 ? '...' : ''));
      }
    }
    console.log('Current beast ID from BeastManager:', currentBeastId);
    console.log('Beasts from BeastManager:', Object.keys(beasts));
    console.log('=== END STORAGE DEBUG ===');
  };
  
  // Fix function to manually migrate the existing custom beast data
  (window as unknown as { fixCustomBeasts?: () => void }).fixCustomBeasts = () => {
    console.log('MANUAL FIX: Finding and migrating custom beast data...');
    const customBeastsToMigrate: Record<string, unknown> = {};
    
    // Find all customBeast_ keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('customBeast_')) {
        const beastId = key.replace('customBeast_', '');
        const customBeastDataString = localStorage.getItem(key);
        if (customBeastDataString) {
          try {
            const customBeastData = JSON.parse(customBeastDataString);
            customBeastsToMigrate[beastId] = customBeastData;
            console.log(`MANUAL FIX: Found custom beast ${beastId}:`, customBeastData);
          } catch (error) {
            console.error(`MANUAL FIX: Failed to parse ${key}:`, error);
          }
        }
      }
    }
    
    if (Object.keys(customBeastsToMigrate).length > 0) {
      // Save to centralized storage
      localStorage.setItem('customBeasts', JSON.stringify(customBeastsToMigrate));
      console.log('MANUAL FIX: Saved custom beasts to centralized storage:', customBeastsToMigrate);
      console.log('MANUAL FIX: Please refresh the page to see the changes');
    } else {
      console.log('MANUAL FIX: No custom beast data found to migrate');
    }
  };
  
  return {
    beasts,
    currentBeastId,
    beastPartInventory,
    inventoryItems,
    gameOptions,
    adventureProgress,
    beastOrder,
    beastNames,
    customBeasts,
    hasPlayedBefore
  };
}

/**
 * Save complete game state to localStorage
 */
function saveGameState(state: GameState): void {
  try {
    // Save each piece of state
    saveToStorage(STORAGE_KEYS.BEAST_PART_INVENTORY, state.beastPartInventory);
    saveToStorage(STORAGE_KEYS.INVENTORY_ITEMS, state.inventoryItems);
    saveToStorage(STORAGE_KEYS.GAME_OPTIONS, state.gameOptions);
    saveToStorage(STORAGE_KEYS.ADVENTURE_PROGRESS, state.adventureProgress);
    saveToStorage(STORAGE_KEYS.BEAST_ORDER, state.beastOrder);
    saveToStorage(STORAGE_KEYS.BEAST_NAMES, state.beastNames);
    saveToStorage(STORAGE_KEYS.CUSTOM_BEASTS, state.customBeasts);
    
    // Save simple flags
    localStorage.setItem(STORAGE_KEYS.HAS_PLAYED_BEFORE, state.hasPlayedBefore ? 'true' : 'false');
    localStorage.setItem(STORAGE_KEYS.CURRENT_BEAST_ID, state.currentBeastId);
    
    // Beast data is handled by BeastManager
    Object.entries(state.beasts).forEach(([beastId, beastData]) => {
      BeastManager.saveBeastData(beastId, beastData);
    });
    
  } catch (error) {
    console.error('Failed to save game state:', error);
  }
}

/**
 * Helper function to load data from localStorage with fallback
 */
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
}

/**
 * Helper function to save data to localStorage
 */
function saveToStorage(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save ${key} to localStorage:`, error);
  }
}
