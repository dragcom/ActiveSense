import { create } from 'zustand'
import { MeshStandardMaterial } from 'three';
import PocketBase from 'pocketbase';
import { persist } from 'zustand/middleware';

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL;
if(!pocketBaseUrl) {
  throw new Error("VITE_POCKETBASE_URL is required in .env.local");
}

export const PHOTO_POSES = {
  Idle: "Idle",
  Chill: "Chill",
  Cool: "Cool",
  Punch: "Punch",
  Ninja: "Ninja",
  King: "King",
  Busy: "Busy",
};

export const UI_MODES = {
  PHOTO: "photo",
  CUSTOMIZE: "customize",
}

export const pb = new PocketBase(pocketBaseUrl);

export const useConfiguratorStore = create(persist((set, get) => ({
  loading: true,
  viewOnly: false,
  mode: UI_MODES.CUSTOMIZE,
  setMode: (mode) => {
    set({ mode });
    if (mode === UI_MODES.CUSTOMIZE) {
      set({ pose: PHOTO_POSES.Idle });
    }
  },
  pose: PHOTO_POSES.Idle,
  setPose: (pose) => set({ pose }),
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
  screenshotRequested: false, 
  triggerScreenshot: () => set({ screenshotRequested: true }),
  
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
        expand: "colourPalette,cameraPlacement",
      });
      
      const assets = await pb.collection('CustomizationAssets').getFullList({
        sort: "-created",
        $autoCancel: false,
      });

      const newCustomization = { ...get().customization };
      
      categories.forEach(category => {
        category.assets = assets.filter((asset) => asset.group === category.id);
        if (!newCustomization[category.name]) {
            const availableColours = category.expand?.colourPalette?.colours;
            const defaultColour = (availableColours && availableColours.length > 0) 
              ? availableColours[0] 
              : "#ffffff";

            newCustomization[category.name] = {
              colour: defaultColour,
              asset: category.startingAsset 
                ? category.assets.find((asset) => asset.id === category.startingAsset) 
                : null,
            };
        }
      });

      set({ 
        categories, 
        currentCategory: categories[0] || null, 
        assets, 
        customization: newCustomization,
        loading: false,
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
      if (assets.length > 0) {
        if (category.removable) {
          const shouldKeep = randInt(1, 4) > 1;
          if (shouldKeep) {
            randomAsset = assets[randInt(0, assets.length - 1)];
          }
        } else {
          randomAsset = assets[randInt(0, assets.length - 1)];
        }
      }

      let randomColour = newCustomization[category.name]?.colour || "";
      if (colours.length > 0 && randomAsset) {
        randomColour = colours[randInt(0, colours.length - 1)];
      }


      newCustomization[category.name] = {
        asset: randomAsset,
        colour: randomColour,
      };

      if (category.name === "Head" && randomColour) {
        get().updateSkin(randomColour);
      }
    });

    set({ customization: newCustomization });
  },

  setHydratedState: (payload) => set((state) => {
    const { avatarConfig, viewOnly } = payload;
    const nextViewOnly = viewOnly !== undefined ? viewOnly : state.viewOnly;
    let newCustomization = { ...state.customization };
    
    if (avatarConfig) {
        Object.keys(avatarConfig).forEach((categoryName) => {
            const config = avatarConfig[categoryName];
            const categoryDef = state.categories.find((c) => c.name === categoryName);
            
            if (categoryDef) {
                const foundAsset = config.assetId 
                    ? categoryDef.assets.find((a) => a.id === config.assetId)
                    : null;

                newCustomization[categoryName] = {
                    ...newCustomization[categoryName],
                    asset: foundAsset || null,
                    colour: config.color || (categoryDef.colourPalette?.colours[0] || null)
                };
            }
        });
    }

    return { 
        customization: newCustomization,
        viewOnly: nextViewOnly 
    };
  }),
}),
{
      name: 'avatar-storage',
      partialize: (state) => ({
        customization: state.customization,
        mode: state.mode,
        pose: state.pose,
        viewOnly: state.viewOnly,
      }),
    }
  )
);
