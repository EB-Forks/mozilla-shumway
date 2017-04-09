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

var frames = [];
var frameMaxIndex = 0;

window.addEventListener("message", (event) => {
  console.log(event);
  let data = event.data;
  if (data.type === "frameLoaded" && frames[data.frameIndex] !== undefined) {
    let frameData = frames[data.frameIndex];
    if (frameData.loaded)
      return;
    frameData.loaded = true
    frameData.frame.contentWindow.postMessage(frameData.loadMessage, '*');
    console.log("message sent");
  }
});

let objs = document.getElementsByTagName("object");
for (let i = 0; i < objs.length; i++) {
  /** @type HTMLObjectElement */
  let obj = objs.item(i);
  let parent = obj.parentNode;
  if (obj.getAttribute("type") !== "application/x-shockwave-flash" || parent === null) {
    continue;
  }

  let swf = obj.getAttribute("data");
  let frameIndex = frameMaxIndex++; // TODO: Use random UUIDs
  let src = browser.extension.getURL("content/shumway.html?id=" + frameIndex);
  let params = obj.getElementsByTagName("param");
  let paramMap = new Map();
  for (let i = 0; i < params.length; i++) {
    /** @type HTMLParamElement */
    let param = params.item(i);
    paramMap.set(param.name, param.value);
  }

  /** @type HTMLIFrameElement */
  let frame = document.createElement("iframe");
  frames[frameIndex] = {
    frame: frame,
    loadMessage: {
      type: "swf",
      swf: swf,
      params: paramMap,
      startupInfo: cloneInto(frame.contentWindow, StartupInfo.getStartupInfo(obj), {cloneFunctions: true, wrapReflectors: true})
    },
    loaded: false
  };

  frame.setAttribute("src", src);
  frame.setAttribute("frameborder", 0);
  frame.setAttribute("sandbox", "allow-scripts");

  // copy element attributes
  if (obj.hasAttribute("id"))        frame.setAttribute("id",        obj.getAttribute("id"));
  if (obj.hasAttribute("className")) frame.setAttribute("className", obj.getAttribute("className"));
  if (obj.hasAttribute("draggable")) frame.setAttribute("draggable", obj.getAttribute("draggable"));
  if (obj.hasAttribute("dir"))       frame.setAttribute("dir",       obj.getAttribute("dir"));
  if (obj.hasAttribute("tabIndex"))  frame.setAttribute("tabIndex",  obj.getAttribute("tabIndex"));
  if (obj.hasAttribute("width"))     frame.setAttribute("width",     obj.getAttribute("width"));
  if (obj.hasAttribute("height"))    frame.setAttribute("height",    obj.getAttribute("height"));
  if (obj.hasAttribute("align"))     frame.setAttribute("align",     obj.getAttribute("align"));
  if (obj.hasAttribute("style"))     frame.setAttribute("style",     obj.getAttribute("style"));
  if (obj.hasAttribute("title"))     frame.setAttribute("title",     obj.getAttribute("title"));
  if (obj.hasAttribute("lang"))      frame.setAttribute("lang",      obj.getAttribute("lang"));
  if (obj.hasAttribute("hidden"))    frame.setAttribute("hidden",    obj.getAttribute("hidden"));

  parent.replaceChild(frame, obj);
}
