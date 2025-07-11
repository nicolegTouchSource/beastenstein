import { useState, useRef, useCallback, useEffect } from 'react';
import { StatusBar } from './components/StatusBar/StatusBar';
import { EditableName } from './components/EditableName/EditableName';
import { BeastDen } from './components/BeastDen/BeastDen';
import { ActionButtons } from './components/ActionButtons/ActionButtons';
import { SidebarBeastSelector } from './components/SidebarBeastSelector/SidebarBeastSelector';
import { Mausoleum } from './components/Mausoleum/Mausoleum';
import { Menu } from './components/Menu/Menu';
import { Inventory } from './components/Inventory/Inventory';
import { Options } from './components/Options/Options';
import { Toast } from './components/Toast/Toast';
import { Adventure } from './components/Adventure/Adventure';
import { Debug } from './components/Debug/Debug';
import { IntroStory } from './components/IntroStory/IntroStory';
import { BeastSelection } from './components/BeastSelection/BeastSelection';
import { InventoryProvider, useInventoryContext } from './contexts/InventoryContext';
import { useBeastStats } from './hooks/useBeastStats';
import { useBeastMovement } from './hooks/useBeastMovement';
import { usePooManager } from './hooks/usePooManager';
import { DEFAULT_ITEMS } from './types/inventory';
import { DEFAULT_OPTIONS } from './types/options';
import type { BeastCombatStats } from './types/game';
import { getRandomPersonality, getDefaultPersonality } from './data/personalities';
import type { IndividualBeastData } from './types/game';
import type { InventoryItem } from './types/inventory';
import type { GameOptions } from './types/options';
import type { Personality } from './data/personalities';
import { createBeastFromTemplate } from './data/beastTemplates';
import { getMaxLevelFromSoul, getSoulStatMultiplier, findSoulEssenceById } from './data/soulEssences';
import { getPartsByBeastType, findExtraLimbById } from './data/beastParts';
import './App.css';

interface BeastPart {
  id: string;
  name: string;
  imagePath: string;
  type: 'head' | 'torso' | 'armLeft' | 'armRight' | 'legLeft' | 'legRight' | 'wings' | 'tail';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  statBonus?: { attack?: number; defense?: number; speed?: number; magic?: number; health?: number };
  ability?: {
    id: string;
    name: string;
    description: string;
    type: 'attack' | 'defense' | 'magicAttack' | 'heal' | 'buff' | 'debuff';
    damage?: number;
    healing?: number;
    effects?: {
      statModifier?: {
        attack?: number;
        defense?: number;
        speed?: number;
        magic?: number;
      };
      duration?: number;
    };
    cooldown: number;
    manaCost?: number;
  };
}

interface SoulEssence {
  id: string;
  name: string;
  description: string;
  imagePath: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

interface CustomBeastData {
  name: string;
  gender: 'male' | 'female';
  personality: Personality;
  head: BeastPart;
  torso: BeastPart;
  armLeft: BeastPart;
  armRight: BeastPart;
  legLeft: BeastPart;
  legRight: BeastPart;
  wings?: BeastPart;
  tail?: BeastPart;
  soulEssence: SoulEssence;
}

function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}

function AppContent() {
  const { setInventory: setBeastPartInventory } = useInventoryContext();
  // Game flow state
  const [gameState, setGameState] = useState<'intro' | 'beastSelection' | 'game'>(() => {
    // Check if this is a first-time user
    const hasPlayed = localStorage.getItem('hasPlayedBefore');
    return hasPlayed ? 'game' : 'intro';
  });

  const [currentBackgroundIndex, setCurrentBackgroundIndex] = useState(0);
  
  // Initialize individual beast data from localStorage (custom beasts only)
  const [beastData, setBeastData] = useState<Record<string, IndividualBeastData>>(() => {
    const customBeastData: Record<string, IndividualBeastData> = {};
    
    // First try to load from consolidated beastData
    const consolidatedData = localStorage.getItem('beastData');
    if (consolidatedData) {
      try {
        const allBeastData = JSON.parse(consolidatedData);
        // Filter for custom beasts only
        Object.keys(allBeastData).forEach(beastId => {
          if (beastId.startsWith('custom_')) {
            const beastData = allBeastData[beastId];
            // Migrate old data without createdAt timestamp
            if (!beastData.createdAt) {
              beastData.createdAt = Date.now();
            }
            customBeastData[beastId] = beastData;
          }
        });
      } catch (error) {
        console.warn('Failed to load consolidated beast data:', error);
      }
    } else {
      // Fallback: Load all custom beast data from individual localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('beastData_custom_')) {
          try {
            const beastId = key.replace('beastData_', '');
            const savedData = localStorage.getItem(key);
            if (savedData) {
              const parsed = JSON.parse(savedData);
              // Migrate old data without createdAt timestamp
              if (!parsed.createdAt) {
                parsed.createdAt = Date.now();
              }
              customBeastData[beastId] = parsed;
            }
          } catch (error) {
            console.warn(`Failed to load beast data for ${key}:`, error);
          }
        }
      }
    }
    
    // Only create default Night Wolf if user has played before and has no beasts
    // (returning users who somehow lost their beasts)
    const hasPlayed = localStorage.getItem('hasPlayedBefore');
    if (Object.keys(customBeastData).length === 0 && hasPlayed) {
      const defaultBeastId = 'custom_default_nightwolf';
      const now = Date.now();
      
      customBeastData[defaultBeastId] = {
        name: 'Night Wolf',
        hunger: 50,
        happiness: 50,
        energy: 50,
        health: 100,
        level: 1,
        age: 0,
        attack: 7,  // Base 6 + 1 from Brave personality
        defense: 6,
        speed: 6,
        magic: 6,
        isResting: false,
        createdAt: now,
        experience: 0,
        maxLevel: 5  // Dim soul max level
      };
      
      // Save the default beast data using consolidated approach
      try {
        const beastDataKey = 'beastData';
        const existingData = localStorage.getItem(beastDataKey);
        const allBeastData = existingData ? JSON.parse(existingData) : {};
        allBeastData[defaultBeastId] = customBeastData[defaultBeastId];
        localStorage.setItem(beastDataKey, JSON.stringify(allBeastData));
      } catch (error) {
        console.error('Failed to save default beast data:', error);
        // Fallback to old method
        localStorage.setItem(`beastData_${defaultBeastId}`, JSON.stringify(customBeastData[defaultBeastId]));
      }
      
      // Create and save the default custom beast configuration
      const defaultCustomBeast = createBeastFromTemplate('nightwolf', 'Night Wolf');
      if (defaultCustomBeast) {
        localStorage.setItem(`customBeast_${defaultBeastId}`, JSON.stringify(defaultCustomBeast));
      }
    }
    
    return customBeastData;
  });

  // Set current beast ID to first available custom beast
  const [currentBeastId, setCurrentBeastId] = useState<string>(() => {
    const beastIds = Object.keys(beastData);
    return beastIds.length > 0 ? beastIds[0] : ''; // Empty string if no beasts initially
  });
  
  const [showInventory, setShowInventory] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [inAdventure, setInAdventure] = useState(false);
  const [showMausoleum, setShowMausoleum] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [showSteakAnimation, setShowSteakAnimation] = useState(false);
  const [isLayingDown, setIsLayingDown] = useState(false);
  
  // Initialize game options from localStorage or defaults
  const [gameOptions, setGameOptions] = useState<GameOptions>(() => {
    const savedOptions = localStorage.getItem('gameOptions');
    if (savedOptions) {
      try {
        return { ...DEFAULT_OPTIONS, ...JSON.parse(savedOptions) };
      } catch (error) {
        console.warn('Failed to parse saved options:', error);
      }
    }
    return DEFAULT_OPTIONS;
  });
  
  // Initialize inventory from localStorage or defaults
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(() => {
    const savedInventory = localStorage.getItem('inventoryItems');
    
    if (savedInventory) {
      try {
        const savedItems = JSON.parse(savedInventory);
        
        // Merge saved data with default items to ensure we have the latest properties
        const mergedItems = DEFAULT_ITEMS.map(defaultItem => {
          const savedItem = savedItems.find((item: { id: string; quantity: number }) => item.id === defaultItem.id);
          return {
            ...defaultItem, // Start with default (includes effect property)
            quantity: savedItem?.quantity ?? defaultItem.quantity // Preserve saved quantity
          };
        });
        
        return mergedItems;
      } catch (error) {
        console.warn('Failed to parse saved inventory:', error);
      }
    }
    
    return DEFAULT_ITEMS;
  });
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const levelUpSoundRef = useRef<HTMLAudioElement>(null);
  const beastDenMusicRef = useRef<HTMLAudioElement>(null);
  const adventureSoundRef = useRef<HTMLAudioElement>(null);
  
  // Get current beast's data
  const currentBeastData = beastData[currentBeastId];

  // Load custom beast data from localStorage on app initialization
  useEffect(() => {
    const loadCustomBeastData = () => {
      const customBeastData: Record<string, IndividualBeastData> = {};
      
      // Scan localStorage for custom beast data entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('beastData_custom_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsedData = JSON.parse(data);
              const beastId = key.replace('beastData_', '');
              customBeastData[beastId] = parsedData;
            }
          } catch (error) {
            console.warn(`Failed to parse custom beast data for key ${key}:`, error);
          }
        }
      }
      
      // Add custom beast data to beastData state if any found
      if (Object.keys(customBeastData).length > 0) {
        setBeastData(prev => ({
          ...prev,
          ...customBeastData
        }));
      }
    };

    loadCustomBeastData();
  }, []); // Run only once on component mount
  
  // Migration function to add gender, personality, and maxLevel to existing custom beasts
  useEffect(() => {
    const migrateExistingBeasts = () => {
      // Get all custom beast keys from localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('customBeast_'));
      
      for (const key of keys) {
        try {
          const customBeastData = localStorage.getItem(key);
          if (customBeastData) {
            const customBeast = JSON.parse(customBeastData);
            let shouldSave = false;
            
            // If the beast doesn't have a gender, assign one based on name
            if (!customBeast.gender) {
              // Default Night Wolf is male, others are random
              customBeast.gender = customBeast.name === 'Night Wolf' ? 'male' : 
                                   (Math.random() < 0.5 ? 'male' : 'female');
              shouldSave = true;
            }
            
            // If the beast doesn't have a personality, assign one based on name
            if (!customBeast.personality) {
              // Default Night Wolf gets Brave personality, others get random
              customBeast.personality = customBeast.name === 'Night Wolf' ? 
                                        getDefaultPersonality() : getRandomPersonality();
              shouldSave = true;
            }
            
            // Migrate Night Wolf parts to include stat bonuses and abilities
            if (customBeast.name === 'Night Wolf' || 
                (customBeast.head?.id === 'nightwolf-head' && customBeast.torso?.id === 'nightwolf-torso')) {
              
              // Get the centralized Night Wolf parts data
              const nightWolfParts = getPartsByBeastType('nightwolf');
              
              // Update head with stat bonus and ability from centralized data
              if (customBeast.head?.id === 'nightwolf-head' && !customBeast.head.statBonus && nightWolfParts.head) {
                customBeast.head.statBonus = nightWolfParts.head.statBonus;
                customBeast.head.ability = nightWolfParts.head.ability;
                shouldSave = true;
              }
              
              // Update torso with stat bonus from centralized data
              if (customBeast.torso?.id === 'nightwolf-torso' && !customBeast.torso.statBonus && nightWolfParts.torso) {
                customBeast.torso.statBonus = nightWolfParts.torso.statBonus;
                shouldSave = true;
              }
              
              // Update arms with stat bonuses and abilities from centralized data
              if (customBeast.armLeft?.id?.includes('nightwolf') && !customBeast.armLeft.statBonus && nightWolfParts.armSet) {
                customBeast.armLeft.statBonus = nightWolfParts.armSet.statBonus;
                customBeast.armLeft.ability = nightWolfParts.armSet.ability;
                shouldSave = true;
              }
              
              if (customBeast.armRight?.id?.includes('nightwolf') && !customBeast.armRight.statBonus && nightWolfParts.armSet) {
                customBeast.armRight.statBonus = nightWolfParts.armSet.statBonus;
                customBeast.armRight.ability = nightWolfParts.armSet.ability;
                shouldSave = true;
              }
              
              // Update legs with stat bonuses and abilities from centralized data
              if (customBeast.legLeft?.id?.includes('nightwolf') && !customBeast.legLeft.statBonus && nightWolfParts.legSet) {
                customBeast.legLeft.statBonus = nightWolfParts.legSet.statBonus;
                customBeast.legLeft.ability = nightWolfParts.legSet.ability;
                shouldSave = true;
              }
              
              if (customBeast.legRight?.id?.includes('nightwolf') && !customBeast.legRight.statBonus && nightWolfParts.legSet) {
                customBeast.legRight.statBonus = nightWolfParts.legSet.statBonus;
                customBeast.legRight.ability = nightWolfParts.legSet.ability;
                shouldSave = true;
              }
              
              // Add tail to Night Wolf if it doesn't have one
              if (!customBeast.tail) {
                const nightWolfTail = findExtraLimbById('nightwolf-extra-tail');
                if (nightWolfTail) {
                  customBeast.tail = nightWolfTail;
                  shouldSave = true;
                }
              }
            }
            
            // Save the updated beast data if changes were made
            if (shouldSave) {
              localStorage.setItem(key, JSON.stringify(customBeast));
            }
          }
        } catch (error) {
          console.warn(`Failed to migrate beast ${key}:`, error);
        }
      }
      
      // Also migrate beast data to add maxLevel
      const beastDataKeys = Object.keys(localStorage).filter(key => key.startsWith('beastData_'));
      
      for (const key of beastDataKeys) {
        try {
          const beastDataString = localStorage.getItem(key);
          if (beastDataString) {
            const beastData = JSON.parse(beastDataString);
            
            // If the beast doesn't have maxLevel, determine it from soul essence
            if (typeof beastData.maxLevel === 'undefined') {
              const beastId = key.replace('beastData_', '');
              const customBeastKey = `customBeast_${beastId}`;
              const customBeastString = localStorage.getItem(customBeastKey);
              
              let maxLevel = 5; // Default to dim soul level
              if (customBeastString) {
                try {
                  const customBeast = JSON.parse(customBeastString);
                  if (customBeast.soulEssence?.id) {
                    maxLevel = getMaxLevelFromSoul(customBeast.soulEssence.id);
                  }
                } catch (e) {
                  console.warn(`Failed to parse custom beast for maxLevel migration: ${customBeastKey}`, e);
                }
              }
              
              beastData.maxLevel = maxLevel;
              localStorage.setItem(key, JSON.stringify(beastData));
              
              // Update the state as well
              setBeastData(prev => ({
                ...prev,
                [beastId]: { ...prev[beastId], maxLevel }
              }));
            }
          }
        } catch (error) {
          console.warn(`Failed to migrate beast data ${key}:`, error);
        }
      }
      
      // Consolidate all individual beastData_${id} keys into a single beastData object
      const consolidatedBeastData: Record<string, IndividualBeastData> = {};
      for (const key of beastDataKeys) {
        try {
          const beastDataString = localStorage.getItem(key);
          if (beastDataString) {
            const beastData = JSON.parse(beastDataString);
            const beastId = key.replace('beastData_', '');
            consolidatedBeastData[beastId] = beastData;
          }
        } catch (error) {
          console.warn(`Failed to consolidate beast data ${key}:`, error);
        }
      }
      
      // Store the consolidated data and remove individual keys
      if (Object.keys(consolidatedBeastData).length > 0) {
        localStorage.setItem('beastData', JSON.stringify(consolidatedBeastData));
        console.log('Consolidated beast data:', consolidatedBeastData);
        
        // Remove individual keys after successful consolidation
        for (const key of beastDataKeys) {
          localStorage.removeItem(key);
        }
      }
    };

    migrateExistingBeasts();
  }, []); // Run only once on component mount

  const [toast, setToast] = useState<{ message: string; show: boolean; type: 'success' | 'info' }>({ 
    message: '', 
    show: false, 
    type: 'success' 
  });
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [previousLevel, setPreviousLevel] = useState(currentBeastData?.level || 1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const {
    stats,
    isResting,
    setIsResting,
    feed,
    play,
    startRest,
    travel,
    cleanup,
    fillHappiness,
    fillHunger,
    getBeastMood,
    getExperience,
    setExternalExperience,
    resetToBaseStats,
    updateHealth
  } = useBeastStats({
    hunger: currentBeastData?.hunger || 50,
    happiness: currentBeastData?.happiness || 50,
    energy: currentBeastData?.energy || 50,
    health: currentBeastData?.health || 100,
    level: currentBeastData?.level || 1,
    age: currentBeastData?.age || 0
  }, currentBeastId, gameOptions, currentBeastData?.createdAt || Date.now(), currentBeastData?.experience || 0, currentBeastData?.maxLevel || 5);

  // Update the hook's resting state when switching beasts
  useEffect(() => {
    setIsResting(currentBeastData?.isResting || false);
  }, [currentBeastId, currentBeastData?.isResting, setIsResting]);

  const { position, facing } = useBeastMovement(isResting, gameAreaRef, gameOptions.disableRandomMovement);
  
  const { poos, cleanupPoo } = usePooManager(isResting, gameAreaRef, gameOptions);

  // Intro flow handlers
  const handleIntroComplete = useCallback(() => {
    setGameState('beastSelection');
  }, []);

  const handleBeastSelected = useCallback((name: string) => {
    // Create the first Night Wolf beast with the chosen name
    const now = Date.now();
    const customBeastId = `custom_${now}`;
    
    const newBeastData: IndividualBeastData = {
      name: name,
      hunger: 90,
      happiness: 90,
      energy: 90,
      health: 100,
      level: 1,
      age: 0,
      attack: 7,  // Base 6 + 1 from Brave personality
      defense: 6,
      speed: 6,
      magic: 6,
      isResting: false,
      createdAt: now,
      experience: 0,
      maxLevel: 5  // Dim soul max level
    };
    
    // Create the custom beast configuration using the factory function
    const customBeast = createBeastFromTemplate('nightwolf', name);
    if (!customBeast) {
      console.error('Failed to create Night Wolf beast from template');
      return;
    }
    
    // Save to state and localStorage
    setBeastData({ [customBeastId]: newBeastData });
    setCurrentBeastId(customBeastId);
    
    // Save to localStorage with consolidated format
    const allBeastData = { [customBeastId]: newBeastData };
    localStorage.setItem('beastData', JSON.stringify(allBeastData));
    localStorage.setItem(`customBeast_${customBeastId}`, JSON.stringify(customBeast));
    localStorage.setItem('hasPlayedBefore', 'true');
    
    // Transition to game
    setGameState('game');
  }, []);

  const handleBeastChange = useCallback((beastId: string) => {
    // All beasts are now custom beasts
    const hasCustomBeastData = beastData[beastId];
    
    if (hasCustomBeastData) {
      setCurrentBeastId(beastId);
    }
  }, [beastData]);

  const handleNameChange = useCallback((newName: string) => {
    setBeastData(prev => ({
      ...prev,
      [currentBeastId]: {
        ...prev[currentBeastId],
        name: newName
      }
    }));
    
    // Also save to localStorage for the EditableName component
    localStorage.setItem(`beastName_${currentBeastId}`, newName);
  }, [currentBeastId]);

  const handleCreateCustomBeast = useCallback((customBeast: CustomBeastData) => {
    // Check if we've reached the maximum beast limit (8 total)
    const totalBeasts = Object.keys(beastData).length;
    
    if (totalBeasts >= 8) {
      setToast({
        message: 'Maximum of 8 beasts allowed! Release a beast to the wild to make room.',
        show: true,
        type: 'info'
      });
      return;
    }
    
    // Create a new custom beast ID
    const customBeastId = `custom_${Date.now()}`;
    const now = Date.now();
    
    // Create new beast data with base stats + personality modifiers
    const baseStats = {
      attack: 6,  // Balanced stats for custom beasts
      defense: 6,
      speed: 6,
      magic: 6,
    };
    
    // Apply personality stat modifiers
    const modifiedStats = {
      attack: baseStats.attack + (customBeast.personality.statModifiers.attack || 0),
      defense: baseStats.defense + (customBeast.personality.statModifiers.defense || 0),
      speed: baseStats.speed + (customBeast.personality.statModifiers.speed || 0),
      magic: baseStats.magic + (customBeast.personality.statModifiers.magic || 0),
    };
    
    const newBeastData: IndividualBeastData = {
      name: customBeast.name,
      hunger: 50,
      happiness: 50,
      energy: 50,
      health: 100,
      level: 1,
      age: 0,
      attack: modifiedStats.attack,
      defense: modifiedStats.defense,
      speed: modifiedStats.speed,
      magic: modifiedStats.magic,
      isResting: false,
      createdAt: now,
      experience: 0,
      maxLevel: getMaxLevelFromSoul(customBeast.soulEssence.id)
    };

    // Add to beast data
    setBeastData(prev => ({
      ...prev,
      [customBeastId]: newBeastData
    }));

    // Save custom beast configuration
    localStorage.setItem(`customBeast_${customBeastId}`, JSON.stringify(customBeast));
    
    // Trigger sidebar refresh to show the new custom beast
    setSidebarRefreshTrigger(prev => prev + 1);
    
    // Switch to the new beast and close mausoleum
    setCurrentBeastId(customBeastId);
    setShowMausoleum(false);
    
    // Show success message
    setToast({
      message: `${customBeast.name} has been created!`,
      show: true,
      type: 'success'
    });
  }, [beastData]);

  // Save beast data to localStorage whenever it changes
  const saveBeastData = useCallback((beastId: string, data: IndividualBeastData) => {
    // Update the consolidated beastData object
    try {
      const beastDataKey = 'beastData';
      const existingData = localStorage.getItem(beastDataKey);
      const allBeastData = existingData ? JSON.parse(existingData) : {};
      
      allBeastData[beastId] = data;
      localStorage.setItem(beastDataKey, JSON.stringify(allBeastData));
      
      console.log(`Saved beast data for ${beastId}:`, data);
    } catch (error) {
      console.error('Failed to save beast data:', error);
      // Fallback to old method if consolidation fails
      localStorage.setItem(`beastData_${beastId}`, JSON.stringify(data));
    }
  }, []);

  // Function to update experience globally (both localStorage and hook state)
  const updateBeastExperience = useCallback((beastId: string, newExperience: number): boolean => {
    try {
      // Update consolidated localStorage
      const beastDataKey = 'beastData';
      const existingData = localStorage.getItem(beastDataKey);
      const allBeastData = existingData ? JSON.parse(existingData) : {};
      
      if (allBeastData[beastId]) {
        allBeastData[beastId].experience = newExperience;
        localStorage.setItem(beastDataKey, JSON.stringify(allBeastData));
        
        // Update the local state
        setBeastData(prev => ({
          ...prev,
          [beastId]: {
            ...prev[beastId],
            experience: newExperience
          }
        }));
        
        // If this is the current beast, update the hook's state too
        if (beastId === currentBeastId) {
          setExternalExperience(newExperience);
        }
        
        console.log(`Updated experience for beast ${beastId} to ${newExperience}`);
        return true;
      } else {
        console.error(`Beast ${beastId} not found in beastData`);
        return false;
      }
    } catch (error) {
      console.error('Failed to update beast experience:', error);
      return false;
    }
  }, [currentBeastId, setExternalExperience]);

  // Update beast data when stats change (with debouncing to prevent flashing)
  useEffect(() => {
    // Don't update if no current beast data exists (e.g., during initial load)
    if (!currentBeastData) return;
    
    const timeoutId = setTimeout(() => {
      setBeastData(prev => {
        const currentStats = prev[currentBeastId];
        const newData = {
          name: currentBeastData.name,
          hunger: stats.hunger,
          happiness: stats.happiness,
          energy: stats.energy,
          health: stats.health,
          level: stats.level,
          age: stats.age,
          attack: currentBeastData.attack,
          defense: currentBeastData.defense,
          speed: currentBeastData.speed,
          magic: currentBeastData.magic,
          isResting: isResting,
          createdAt: currentBeastData.createdAt,
          experience: getExperience(),
          maxLevel: currentBeastData.maxLevel || 5  // Preserve existing maxLevel or default to 5
        };
        
        // Only update if the stats have actually changed
        if (
          currentStats.hunger !== stats.hunger ||
          currentStats.happiness !== stats.happiness ||
          currentStats.energy !== stats.energy ||
          currentStats.health !== stats.health ||
          currentStats.level !== stats.level ||
          currentStats.age !== stats.age ||
          currentStats.isResting !== isResting ||
          currentStats.experience !== getExperience()
        ) {
          saveBeastData(currentBeastId, newData);
          return {
            ...prev,
            [currentBeastId]: newData
          };
        }
        
        return prev; // No change needed
      });
    }, 50); // 50ms debounce

    return () => clearTimeout(timeoutId);
  }, [stats.hunger, stats.happiness, stats.energy, stats.health, stats.level, stats.age, isResting, currentBeastId, currentBeastData, saveBeastData, getExperience]);

  // Level up detection and celebration
  useEffect(() => {
    // Don't trigger level up animation on initial load or if previous level is invalid or no beast data
    if (stats.level > previousLevel && !isInitialLoad && previousLevel > 0 && currentBeastData) {
      // Get the soul essence multiplier for this beast
      let soulMultiplier = 1; // Default multiplier
      try {
        const customBeastData = localStorage.getItem(`customBeast_${currentBeastId}`);
        if (customBeastData) {
          const customBeast = JSON.parse(customBeastData);
          if (customBeast.soulEssence?.id) {
            soulMultiplier = getSoulStatMultiplier(customBeast.soulEssence.id);
          }
        }
      } catch (error) {
        console.error('Failed to get soul multiplier:', error);
      }
      
      setShowLevelUp(true);
      setToast({
        message: `🎉 ${currentBeastData.name} reached Level ${stats.level}! (+${soulMultiplier} to all stats, +10 health)`,
        show: true,
        type: 'success'
      });

      // Play level up sound
      if (levelUpSoundRef.current && gameOptions.soundEffectsEnabled) {
        levelUpSoundRef.current.currentTime = 0; // Reset to beginning
        levelUpSoundRef.current.volume = 0.7; // Set volume to 70%
        levelUpSoundRef.current.play().catch(error => {
          console.log('Could not play level up sound:', error);
        });
      }
      
      // Increase all combat stats based on soul essence rarity
      const levelsGained = stats.level - previousLevel;
      const statIncrease = levelsGained * soulMultiplier; // Base +1 per level, multiplied by soul rarity
      const healthIncrease = levelsGained * 10; // +10 health per level (unchanged)
      
      setBeastData(prev => {
        const updatedData = {
          ...prev[currentBeastId],
          attack: prev[currentBeastId].attack + statIncrease,
          defense: prev[currentBeastId].defense + statIncrease,
          speed: prev[currentBeastId].speed + statIncrease,
          magic: prev[currentBeastId].magic + statIncrease,
          health: prev[currentBeastId].health + healthIncrease
        };
        
        saveBeastData(currentBeastId, updatedData);
        
        return {
          ...prev,
          [currentBeastId]: updatedData
        };
      });

      // Also update the current health in the stats hook to match the new max health
      updateHealth(stats.health + healthIncrease);
      
      // Hide level up effect after animation
      setTimeout(() => {
        setShowLevelUp(false);
      }, 3000);
    }
    setPreviousLevel(stats.level);
    
    // Mark that initial load is complete
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [stats.level, stats.health, previousLevel, currentBeastData, isInitialLoad, currentBeastId, saveBeastData, gameOptions.soundEffectsEnabled, updateHealth]);

  // Beast den music management
  useEffect(() => {
    const musicElement = beastDenMusicRef.current;
    
    if (gameState === 'game' && musicElement && gameOptions.musicEnabled) {
      if (!inAdventure) {
        // Play beast den music when in the beast den
        musicElement.volume = 0.2; // Set volume to 30%
        musicElement.loop = true; // Loop the music
        musicElement.play().catch(error => {
          console.log('Could not play beast den music:', error);
        });
      } else {
        // Stop beast den music when in adventure
        musicElement.pause();
        musicElement.currentTime = 0; // Reset to beginning
      }
    } else if (musicElement) {
      // Stop music if music is disabled
      musicElement.pause();
      musicElement.currentTime = 0;
    }

    // Cleanup function to stop music when component unmounts or game state changes
    return () => {
      if (musicElement) {
        musicElement.pause();
        musicElement.currentTime = 0;
      }
    };
  }, [gameState, inAdventure, gameOptions.musicEnabled]);

  // Initialize previous level when switching beasts
  useEffect(() => {
    if (currentBeastData) {
      setPreviousLevel(currentBeastData.level);
      setIsInitialLoad(true); // Reset initial load flag when switching beasts
    }
  }, [currentBeastId, currentBeastData]);

  // Function to get species name based on head and torso parts (custom beasts only)
  const getBeastSpecies = useCallback((beastId: string): string => {
    // All beasts are now custom beasts
    if (beastId.startsWith('custom_')) {
      try {
        const customBeastData = localStorage.getItem(`customBeast_${beastId}`);
        if (customBeastData) {
          const customBeast = JSON.parse(customBeastData);
          
          // Extract species from head part image path
          // Example: "./images/beasts/night-wolf/night-wolf-head.svg" -> "wolf"
          let headSpecies = '';
          if (customBeast.head?.imagePath) {
            const headImagePath = customBeast.head.imagePath;
            // Extract filename from path and remove extension
            const headFileName = headImagePath.split('/').pop()?.replace(/\.(svg|png|jpg|jpeg)$/i, '') || '';
            // Split by hyphens and take the second word
            const headParts = headFileName.split('-');
            if (headParts.length >= 2) {
              headSpecies = headParts[1]; // "night-wolf-head" -> "wolf"
            }
          }
          
          // Extract species from torso part image path  
          // Example: "./images/beasts/night-wolf/night-wolf-torso.svg" -> "night"
          let torsoSpecies = '';
          if (customBeast.torso?.imagePath) {
            const torsoImagePath = customBeast.torso.imagePath;
            // Extract filename from path and remove extension
            const torsoFileName = torsoImagePath.split('/').pop()?.replace(/\.(svg|png|jpg|jpeg)$/i, '') || '';
            // Split by hyphens and take the first word
            const torsoParts = torsoFileName.split('-');
            if (torsoParts.length >= 1) {
              torsoSpecies = torsoParts[0]; // "night-wolf-torso" -> "night"
            }
          }
          
          if (headSpecies && torsoSpecies) {
            // Capitalize first letter of each word
            const capitalizedTorso = torsoSpecies.charAt(0).toUpperCase() + torsoSpecies.slice(1);
            const capitalizedHead = headSpecies.charAt(0).toUpperCase() + headSpecies.slice(1);
            return `${capitalizedTorso} ${capitalizedHead}`;
          }
        }
      } catch (error) {
        console.warn(`Failed to determine species for custom beast ${beastId}:`, error);
      }
    }
    return 'Unknown Species';
  }, []);

  // Function to get gender symbol for a custom beast
  const getBeastGender = useCallback((beastId: string): { symbol: string; gender: string } => {
    if (beastId.startsWith('custom_')) {
      try {
        const customBeastData = localStorage.getItem(`customBeast_${beastId}`);
        if (customBeastData) {
          const customBeast = JSON.parse(customBeastData);
          const gender = customBeast.gender;
          return {
            symbol: gender === 'male' ? '♂' : '♀',
            gender: gender
          };
        }
      } catch (error) {
        console.warn(`Failed to get gender for custom beast ${beastId}:`, error);
      }
    }
    return { symbol: '', gender: '' };
  }, []);

  // Function to get personality name for a custom beast
  const getBeastPersonality = useCallback((beastId: string): string => {
    if (beastId.startsWith('custom_')) {
      try {
        const customBeastData = localStorage.getItem(`customBeast_${beastId}`);
        if (customBeastData) {
          const customBeast = JSON.parse(customBeastData);
          return customBeast.personality?.name || 'Unknown';
        }
      } catch (error) {
        console.warn(`Failed to get personality for custom beast ${beastId}:`, error);
      }
    }
    return '';
  }, []);

  // Menu handlers
  const handleOptions = useCallback(() => {
    setShowOptions(true);
  }, []);

  const handleOptionsChange = useCallback((newOptions: GameOptions) => {
    setGameOptions(newOptions);
    localStorage.setItem('gameOptions', JSON.stringify(newOptions));
    
    setToast({
      message: '⚙️ Options updated successfully!',
      show: true,
      type: 'success'
    });
  }, []);

  const handleSave = useCallback(() => {
    // TODO: Implement save functionality  
    console.log('Save clicked - functionality to be implemented');
  }, []);

  const handleInventory = useCallback(() => {
    setShowInventory(true);
  }, []);

  const handleAdventure = useCallback(() => {
    // Play adventure sound effect
    if (adventureSoundRef.current && gameOptions.soundEffectsEnabled) {
      adventureSoundRef.current.currentTime = 0;
      adventureSoundRef.current.volume = 0.1;
      adventureSoundRef.current.play().catch(error => {
        console.log('Could not play adventure sound:', error);
      });
    }
    
    setInAdventure(prev => !prev);
  }, [gameOptions.soundEffectsEnabled]);

  const handleDebug = useCallback(() => {
    setShowDebug(true);
  }, []);

  const handleItemClick = useCallback((itemId: string) => {
    // Find the item to check its effect
    const item = inventoryItems.find(item => item.id === itemId);
    if (!item || item.quantity <= 0) return;

    // Apply item effect based on type
    switch (item.effect) {
      case 'happiness':
        // Stuffed Lion - fill happiness to 100
        fillHappiness();
        setToast({ 
          message: `🦁 ${item.name} used! Happiness is now full!`, 
          show: true, 
          type: 'success' 
        });
        break;
        
      case 'hunger':
        // Beast Biscuit - fill hunger to 100
        fillHunger();
        setToast({ 
          message: `🍪 ${item.name} used! Hunger is now full!`, 
          show: true, 
          type: 'success' 
        });
        break;
        
      case 'cleanup': {
        // Shovel - clean up all poos
        const pooCount = poos.length;
        poos.forEach(poo => {
          cleanupPoo(poo.id);
        });
        // Also give happiness boost for cleaning
        cleanup();
        setToast({ 
          message: `🔧 ${item.name} used! Cleaned up ${pooCount} poo${pooCount !== 1 ? 's' : ''}!`, 
          show: true, 
          type: 'success' 
        });
        break;
      }
        
      default:
        // No effect for unknown items
        setToast({ 
          message: `${item.name} used but had no effect.`, 
          show: true, 
          type: 'info' 
        });
        break;
    }

    // Reduce item quantity
    setInventoryItems(prevItems => {
      const updatedItems = prevItems.map(item => {
        if (item.id === itemId && item.quantity > 0) {
          return { ...item, quantity: item.quantity - 1 };
        }
        return item;
      });
      
      // Save to localStorage
      localStorage.setItem('inventoryItems', JSON.stringify(updatedItems));
      return updatedItems;
    });
  }, [inventoryItems, fillHappiness, fillHunger, cleanup, poos, cleanupPoo, setToast]);

  const handlePooCleanup = useCallback((pooId: string) => {
    cleanupPoo(pooId);
    cleanup(); // Boost happiness for cleaning up
  }, [cleanupPoo, cleanup]);

  const handleTravel = useCallback(() => {
    travel();
    setCurrentBackgroundIndex((prev) => (prev + 1) % 4);
  }, [travel]);

  const createTennisBall = useCallback(() => {
    if (!gameAreaRef.current || isResting) return;

    const gameArea = gameAreaRef.current;
    const tennisBall = document.createElement('div');
    tennisBall.className = 'tennis-ball';
    
    const ballImg = document.createElement('img');
    ballImg.src = './images/tennisBall.svg';
    ballImg.alt = 'Tennis Ball';
    tennisBall.appendChild(ballImg);
    
    gameArea.appendChild(tennisBall);
    
    requestAnimationFrame(() => {
      tennisBall.classList.add('bounce-animation');
    });
    
    setTimeout(() => {
      if (tennisBall.parentNode) {
        tennisBall.remove();
      }
    }, 2500);
  }, [isResting]);

  const handleReleaseToWild = useCallback(() => {
    const beastName = currentBeastData?.name || 'Beast';
    
    // Check if this is the last beast - prevent deletion if so
    const remainingBeasts = Object.keys(beastData).filter(id => id !== currentBeastId);
    if (remainingBeasts.length === 0) {
      setToast({
        message: 'Cannot release the last beast to the wild! You must have at least one beast.',
        show: true,
        type: 'info'
      });
      return;
    }
    
    const confirmed = window.confirm(
      `Are you sure you want to release ${beastName} to the wild? This will permanently delete this beast and cannot be undone.`
    );
    
    if (!confirmed) return;

    // Remove beast data from state
    setBeastData(prev => {
      const newData = { ...prev };
      delete newData[currentBeastId];
      return newData;
    });

    // Remove from localStorage
    try {
      const beastDataKey = 'beastData';
      const existingData = localStorage.getItem(beastDataKey);
      if (existingData) {
        const allBeastData = JSON.parse(existingData);
        delete allBeastData[currentBeastId];
        localStorage.setItem(beastDataKey, JSON.stringify(allBeastData));
      }
    } catch (error) {
      console.error('Failed to remove beast from consolidated data:', error);
      // Fallback to old method
      localStorage.removeItem(`beastData_${currentBeastId}`);
    }
    localStorage.removeItem(`beastName_${currentBeastId}`);
    
    // If it's a custom beast, also remove the custom beast config
    if (currentBeastId.startsWith('custom_')) {
      localStorage.removeItem(`customBeast_${currentBeastId}`);
    }

    // Switch to the first remaining beast
    const firstRemainingBeast = Object.keys(beastData).find(id => id !== currentBeastId);
    if (firstRemainingBeast) {
      setCurrentBeastId(firstRemainingBeast);
    }
    
    // Add a Dim Soul to inventory as a reward for releasing the beast
    setInventoryItems(prevItems => {
      const updatedItems = prevItems.map(item => {
        if (item.id === 'dim-soul') {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      });
      
      // Save to localStorage
      localStorage.setItem('inventoryItems', JSON.stringify(updatedItems));
      return updatedItems;
    });
    
    // Also add a Dim Soul to the beast part inventory (used by Mausoleum)
    setBeastPartInventory(prevInventory => {
      const updatedInventory = {
        ...prevInventory,
        soulEssences: {
          ...prevInventory.soulEssences,
          'dim-soul': (prevInventory.soulEssences['dim-soul'] || 0) + 1
        }
      };
      return updatedInventory;
    });
    
    // Trigger sidebar refresh to update the beast list
    setSidebarRefreshTrigger(prev => prev + 1);
    
    // Show confirmation message
    setToast({
      message: `${beastName} has been released to the wild 🌿 You received a Dim Soul!`,
      show: true,
      type: 'info'
    });
  }, [currentBeastId, currentBeastData, beastData, setBeastData, setSidebarRefreshTrigger, setToast, setBeastPartInventory]);

  const handlePlay = useCallback(() => {
    play();
    createTennisBall();
  }, [play, createTennisBall]);

  const handleFeed = useCallback(() => {
    feed();
    setShowSteakAnimation(true);
  }, [feed]);

  const handleSteakAnimationComplete = useCallback(() => {
    setShowSteakAnimation(false);
  }, []);

  const handleRest = useCallback(() => {
    // Trigger laying down animation first
    setIsLayingDown(true);
    
    // After the laying animation completes, start the actual rest
    setTimeout(() => {
      startRest();
      // Keep laying animation for a bit longer to show the beast is resting
      setTimeout(() => {
        setIsLayingDown(false);
      }, 2000); // Beast stays laying for 2 seconds
    }, 1500); // Wait for laying animation to complete (1.5 seconds)
  }, [startRest]);

  const handleResetAllBeasts = useCallback(() => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      "⚠️ Are you sure you want to reset ALL beasts to base stats?\n\n" +
      "This will:\n" +
      "• Set all stats to base values (Level 1, 50 hunger/happiness/energy, 100 health, 0 age)\n" +
      "• Keep beast names and combat stats\n" +
      "• Reset creation time to now\n\n" +
      "This action cannot be undone!"
    );
    
    if (!confirmed) return;
    
    const now = Date.now();
    
    setBeastData(prev => {
      const resetData: Record<string, IndividualBeastData> = {};
      
      Object.keys(prev).forEach(beastId => {
        const currentBeast = prev[beastId];
        resetData[beastId] = {
          ...currentBeast,
          hunger: 50,
          happiness: 50,
          energy: 50,
          health: 100,
          level: 1,
          age: 0,
          isResting: false,
          createdAt: now
        };
        
        // Save to localStorage using consolidated approach
        try {
          const beastDataKey = 'beastData';
          const existingData = localStorage.getItem(beastDataKey);
          const allBeastData = existingData ? JSON.parse(existingData) : {};
          allBeastData[beastId] = resetData[beastId];
          localStorage.setItem(beastDataKey, JSON.stringify(allBeastData));
        } catch (error) {
          console.error('Failed to save reset data:', error);
          // Fallback to old method
          localStorage.setItem(`beastData_${beastId}`, JSON.stringify(resetData[beastId]));
        }
      });
      
      return resetData;
    });

    // Immediately reset the current beast's stats in the hook
    resetToBaseStats();
    
    setToast({
      message: 'Beast has been reset to default stats!',
      show: true,
      type: 'info'
    });
    
    // Close debug panel
    setShowDebug(false);
  }, [resetToBaseStats, setToast, setShowDebug]);

  // Calculate enhanced combat stats including stat bonuses from beast parts
  const getEnhancedCombatStats = (beastId: string): BeastCombatStats => {
    const baseStats = {
      attack: currentBeastData?.attack || 0,
      defense: currentBeastData?.defense || 0,
      speed: currentBeastData?.speed || 0,
      magic: currentBeastData?.magic || 0
    };

    try {
      const customBeastData = localStorage.getItem(`customBeast_${beastId}`);
      if (customBeastData) {
        const customBeast = JSON.parse(customBeastData);
        
        // Calculate stat bonuses from all parts
        let attackBonus = 0;
        let defenseBonus = 0;
        let speedBonus = 0;
        let magicBonus = 0;

        // Add bonuses from each part
        [customBeast.head, customBeast.torso, customBeast.armLeft, customBeast.armRight, customBeast.legLeft, customBeast.legRight].forEach(part => {
          if (part?.statBonus) {
            attackBonus += part.statBonus.attack || 0;
            defenseBonus += part.statBonus.defense || 0;
            speedBonus += part.statBonus.speed || 0;
            magicBonus += part.statBonus.magic || 0;
          }
        });

        return {
          attack: baseStats.attack + attackBonus,
          defense: baseStats.defense + defenseBonus,
          speed: baseStats.speed + speedBonus,
          magic: baseStats.magic + magicBonus
        };
      }
    } catch (error) {
      console.error('Failed to load custom beast data for enhanced stats:', error);
    }

    return baseStats;
  };

  // Calculate enhanced health including health bonuses from beast parts
  const getEnhancedHealth = (beastId: string): number => {
    const baseHealth = currentBeastData?.health || 100;

    try {
      const customBeastData = localStorage.getItem(`customBeast_${beastId}`);
      if (customBeastData) {
        const customBeast = JSON.parse(customBeastData);
        
        let healthBonus = 0;

        // Add health bonuses from all parts
        [customBeast.head, customBeast.torso, customBeast.armLeft, customBeast.armRight, customBeast.legLeft, customBeast.legRight].forEach(part => {
          if (part?.statBonus) {
            healthBonus += part.statBonus.health || 0;
          }
        });

        return baseHealth + healthBonus;
      }
    } catch (error) {
      console.error('Failed to load custom beast data for enhanced health:', error);
    }

    return baseHealth;
  };

  return (
      <div className="App">
        {/* Intro Story Screen */}
        {gameState === 'intro' && (
          <IntroStory 
            onComplete={handleIntroComplete} 
            musicEnabled={gameOptions.musicEnabled}
          />
        )}

        {/* Beast Selection Screen */}
        {gameState === 'beastSelection' && (
          <BeastSelection onBeastSelected={handleBeastSelected} />
        )}

        {/* Main Game Screen */}
        {gameState === 'game' && currentBeastData && (
          <>
            <Menu 
              onOptions={handleOptions}
              onSave={handleSave}
              onInventory={handleInventory}
              onDebug={handleDebug}
            />

            {/* Beast name and info in upper left */}
            <div className="beast-header">
              <h1><EditableName 
                key={currentBeastId}
                initialName={currentBeastData.name} 
          onNameChange={handleNameChange} 
          beastId={currentBeastId} 
        /></h1>
        
        <div className="beast-info-plate">
          <div className="info-text">
            <span className="species-text">
              {(() => {
                const personality = getBeastPersonality(currentBeastId);
                return personality ? (
                  <span className="personality-text">
                    {personality}
                  </span>
                ) : null;
              })()}
              {getBeastSpecies(currentBeastId)}
              {(() => {
                const genderInfo = getBeastGender(currentBeastId);
                return genderInfo.symbol ? (
                  <span className={`gender-symbol ${genderInfo.gender}`}>
                    {genderInfo.symbol}
                  </span>
                ) : null;
              })()}
            </span>
            <span>LEVEL {stats.level}/{currentBeastData.maxLevel || 5}</span>
            <span>AGE {stats.age}</span>
            <span>EXP {getExperience()}/{stats.level * 100}</span>
          </div>
        </div>
      </div>

      {/* Top stats bar - compact horizontal layout */}
      <div id="top-stats-container">
        <StatusBar label="Health" value={stats.health} id="health" />
        <StatusBar label="Hunger" value={stats.hunger} id="hunger" />
        <StatusBar label="Happiness" value={stats.happiness} id="happiness" />
        <StatusBar label="Energy" value={stats.energy} id="energy" />
      </div>

      {/* Sidebar Beast Selector */}
      <SidebarBeastSelector
        currentBeastId={currentBeastId}
        onBeastChange={handleBeastChange}
        beastData={beastData}
        onCreateBeast={() => {
          setShowMausoleum(true);
        }}
        refreshTrigger={sidebarRefreshTrigger}
      />
      
      {showInventory && (
        <Inventory 
          items={inventoryItems}
          onItemClick={handleItemClick}
          onClose={() => setShowInventory(false)}
          isModal={true}
        />
      )}
      
      {showOptions && (
        <Options 
          options={gameOptions}
          onOptionsChange={handleOptionsChange}
          onClose={() => setShowOptions(false)}
          isModal={true}
        />
      )}
      
      {showDebug && (
        <Debug 
          options={gameOptions}
          onOptionsChange={handleOptionsChange}
          onClose={() => setShowDebug(false)}
          isModal={true}
          onResetAllBeasts={handleResetAllBeasts}
        />
      )}
      
      {showMausoleum && (
        <Mausoleum
          onClose={() => setShowMausoleum(false)}
          onCreateBeast={handleCreateCustomBeast}
        />
      )}
      
      {inAdventure ? (
        <Adventure
          playerStats={{
            ...getEnhancedCombatStats(currentBeastId),
            health: getEnhancedHealth(currentBeastId)
          }}
          onClose={() => setInAdventure(false)}
          onUpdateExperience={updateBeastExperience}
          soundEffectsEnabled={gameOptions.soundEffectsEnabled}
          beastData={beastData}
        />
      ) : (
        <>
          <BeastDen
            ref={gameAreaRef}
            backgroundIndex={currentBackgroundIndex}
            beastMood={getBeastMood()}
            isResting={isResting}
            isLayingDown={isLayingDown}
            beastPosition={position}
            beastFacing={facing}
            beastId={currentBeastId}
            hunger={stats.hunger}
            poos={poos}
            onFeedFromBowl={handleFeed}
            onRestFromBed={handleRest}
            onCleanupPoo={handlePooCleanup}
            showSteakAnimation={showSteakAnimation}
            onSteakAnimationComplete={handleSteakAnimationComplete}
            soundEffectsEnabled={gameOptions.soundEffectsEnabled}
          />

          {/* Adventure Button - Outside of Beast Den */}
          <div className="adventure-button-container">
            <button 
              className="adventure-button"
              onClick={handleAdventure}
              title="Enter the Adventure Mode"
            >
              <div className="adventure-button-icon">🗺️</div>
              <div className="adventure-button-text">VIEW YOUR MAP</div>
            </button>
          </div>

          {/* Combat Stats Container - positioned on the right side */}
          <div className="combat-stats-container">
            <div className="combat-stats-table">
              <h4 className="stats-title">Combat Stats ✨</h4>
              <div className="stats-subtitle">Enhanced with Part Bonuses</div>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-icon">⚔️</span>
                  <span className="stat-label">Attack</span>
                  <span className="stat-value">{getEnhancedCombatStats(currentBeastId).attack}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🛡️</span>
                  <span className="stat-label">Defense</span>
                  <span className="stat-value">{getEnhancedCombatStats(currentBeastId).defense}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">⚡</span>
                  <span className="stat-label">Speed</span>
                  <span className="stat-value">{getEnhancedCombatStats(currentBeastId).speed}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🔮</span>
                  <span className="stat-label">Magic</span>
                  <span className="stat-value">{getEnhancedCombatStats(currentBeastId).magic}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">❤️</span>
                  <span className="stat-label">Health</span>
                  <span className="stat-value">{getEnhancedHealth(currentBeastId)}</span>
                </div>
              </div>
              
              {/* Soul Essence Display */}
              <div className="soul-essence-display">
                <h5 className="soul-essence-title">Soul Essence</h5>
                {(() => {
                  let soulEssence = null;
                  
                  try {
                    const customBeastData = localStorage.getItem(`customBeast_${currentBeastId}`);
                    if (customBeastData) {
                      const customBeast = JSON.parse(customBeastData);
                      if (customBeast.soulEssence?.id) {
                        soulEssence = findSoulEssenceById(customBeast.soulEssence.id);
                      }
                    }
                  } catch (error) {
                    console.error('Failed to get soul essence:', error);
                  }
                  
                  if (soulEssence) {
                    return (
                      <div className="soul-essence-info">
                        <div className="soul-essence-icon">
                          <img src={soulEssence.imagePath} alt={soulEssence.name} />
                        </div>
                        <div className="soul-essence-details">
                          <div className="soul-essence-name">{soulEssence.name}</div>
                          <div className={`soul-essence-rarity ${soulEssence.rarity}`}>{soulEssence.rarity}</div>
                          <div className="soul-essence-level-cap">Max Level: {soulEssence.maxLevel}</div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="soul-essence-info">
                      <div className="soul-essence-name">No Soul</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          <ActionButtons
            onFeed={handleFeed}
            onPlay={handlePlay}
            onRest={handleRest}
            onTravel={handleTravel}
            onReleaseToWild={handleReleaseToWild}
            isResting={isResting}
          />
        </>
      )}

      <Toast
        message={toast.message}
        show={toast.show}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />

      {showLevelUp && (
        <div className="level-up-effect">
          🎉 LEVEL UP! 🎉
        </div>
      )}

      {/* Level up sound effect */}
      <audio
        ref={levelUpSoundRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="./sounds/chime2.mp3" type="audio/mpeg" />
      </audio>

      {/* Beast den background music */}
      <audio
        ref={beastDenMusicRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="./sounds/beast-den-music.mp3" type="audio/mpeg" />
      </audio>

      {/* Adventure sound effect */}
      <audio
        ref={adventureSoundRef}
        preload="auto"
        style={{ display: 'none' }}
      >
        <source src="./sounds/dungeon_door1.mp3" type="audio/mpeg" />
      </audio>
          </>
        )}
      </div>
  );
}

export default App;
