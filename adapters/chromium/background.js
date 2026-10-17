import {autoLoadInspector} from "./auto.js";
import {createBackground} from "./background-controller.js";
import {version} from "./version.js";

createBackground(chrome, autoLoadInspector, version);
