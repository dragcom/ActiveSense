import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

// Expo starts here and hands control to the App component.
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
