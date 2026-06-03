import { create } from 'zustand'
import { MeshStandardMaterial } from 'three';
import PocketBase from 'pocketbase';

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL;
if(!pocketBaseUrl) {
  throw new Error("VITE_POCKETBASE_URL is required in .env.local");
}

export const pb = new PocketBase(pocketBaseUrl);

export const useConfiguratorStore = create((set, get) => ({
  categories: [],
  currentCategory: null,
  assets: [],
  skin: new MeshStandardMaterial({
    color: 0xf5c6a5,
    roughness: 1,
  }),
  customization: {}, 
  download: () => {},
  setDownload: (download) => set({ download }),
  
  updateColor: (colour) => {
    set((state) => ({
      customization: {
        ...state.customization,
        [state.currentCategory.name]: {
          ...state.customization[state.currentCategory.name],
          colour,
        },
      },
    }));
    if (get().currentCategory.name === "Head") {
      get().updateSkin(colour);
    }
  },

  updateSkin: (color) => {
    get().skin.color.set(color);
  },
  
  fetchCategories: async () => {
    try {
      const categories = await pb.collection('CustomizationGroups').getFullList({
        sort: "+position",
        $autoCancel: false,
        expand: "colourPalette",
      });
      
      const assets = await pb.collection('CustomizationAssets').getFullList({
        sort: "-created",
        $autoCancel: false,
      });

      const customization = {};
      
      categories.forEach(category => {
        category.assets = assets.filter((asset) => asset.group === category.id);
        
        // Safely pick the first color or fall back to a placeholder
        const availableColours = category.expand?.colourPalette?.colours;
        const defaultColour = (availableColours && availableColours.length > 0) 
          ? availableColours[0] 
          : "#ffffff"; // Fallback to white if no palette exists

        customization[category.name] = {
          colour: defaultColour,
          asset: null,
        };
        
        if(category.startingAsset) {
          customization[category.name].asset = category.assets.find(
            (asset) => asset.id === category.startingAsset
          );
        }
      });

      // currentCategory must point to the first item (categories[0]), not the whole array
      set({ 
        categories, 
        currentCategory: categories[0] || null, 
        assets, 
        customization 
      });

    } catch (error) {
      console.error("Failed to fetch initial configuration categories:", error);
    }
  },
  
  setCurrentCategory: (category) => set({ currentCategory: category }),
  
  changeAsset: (category, asset) => 
    set((state) => ({
      customization: {
        ...state.customization,
        [category]: {
          ...state.customization[category],
          asset,
        },
      },
    })),
    
  randomize: () => {
    const { categories, customization } = get();
    if (!categories || categories.length === 0) return;

    const newCustomization = { ...customization };

    categories.forEach((category) => {
      const assets = category.assets || [];
      const colours = category.expand?.colourPalette?.colours || [];
      
      let randomAsset = null;

      // 1. SAFE ASSET RANDOMIZATION (Handles empty or removable assets safely)
      if (assets.length > 0) {
        if (category.removable) {
          // 25% chance to remove/leave item empty, 75% chance to pick a random asset
          const shouldKeep = randInt(1, 4) > 1;
          if (shouldKeep) {
            randomAsset = assets[randInt(0, assets.length - 1)];
          }
        } else {
          randomAsset = assets[randInt(0, assets.length - 1)];
        }
      }

      // 2. SAFE COLOUR RANDOMIZATION
      let randomColour = newCustomization[category.name]?.colour || "";
      if (colours.length > 0 && randomAsset) {
        randomColour = colours[randInt(0, colours.length - 1)];
      }

      // 3. APPLY TO STATE
      newCustomization[category.name] = {
        asset: randomAsset,
        colour: randomColour, // Fixed: Unified key property name to 'colour'
      };

      // 4. SYNC THREE.JS SKIN MATERIAL
      if (category.name === "Head" && randomColour) {
        get().updateSkin(randomColour);
      }
    });

    set({ customization: newCustomization });
  }
}));
