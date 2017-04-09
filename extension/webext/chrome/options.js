/*
 * Copyright 2017 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Saves options to browser.storage.local.
 *
 * @param {Number} stack_depth
 * @returns {undefined}
 */
function save_options(stack_depth) {
  browser.storage.local.set({
    playerSettings: {
      hud: document.getElementById('hud').checked
    }
  }).then(() => {
    console.info("[Shumway]", "Sucessfully saved options.");
  }).catch((error) => {
    console.warning("[Shumway]", "Error while saving options:", error, "stack_depth = " + stack_depth);
    if (stack_depth > 10) {
      console.error("[Shumway]", "Couldn't save options.");
      return;
    } else {
      save_options(stack_depth + 1); // Attempt to re-save options.
    }
  });
}

// Restores select box and checkbox state using the preferences
// stored in browser.storage.
function restore_options() {
  browser.storage.local.get({
    playerSettings: {
      hud: false
    }
  }).then((settings) => {
    document.getElementById('hud').checked = settings.playerSettings.hud;
  }).catch((error) => {
    document.getElementById('hud').checked = false;
  });
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('hud').addEventListener('click', () => {save_options(0)});

