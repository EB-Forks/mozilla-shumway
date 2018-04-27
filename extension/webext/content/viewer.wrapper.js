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

/** @type HTMLIFrameElement */
const viewer = document.querySelector('#viewer');
let resolveLoad;
const loadedPromise = new Promise(resolve => {
  resolveLoad = resolve;
});

viewer.addEventListener('load', async e => {
  const data = await loadedPromise;
  viewer.contentWindow.postMessage(data, '*');
});

window.addEventListener('message', async e => {
  console.log('[shumway:content]',e.data);
  const args = e.data;
  if (typeof args !== 'object' || args === null) {
    return;
  }
  if (args.type === 'swf') {
    resolveLoad(args);
  }
});
console.log('[shumway:content]','added message listener');
