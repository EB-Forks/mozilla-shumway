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
/* global browser */

//import { getStartupInfo } from 'StartupInfo';
/** @typedef {Node} ShadowRoot */

(async () => {
  const STYLE=`
:host([width]) {
  width: attr(width px);
}

:host([height]) {
  height: attr(height px);
}

iframe {
  display: block;
  overflow: hidden;
  line-height: 0;
  border: none;
	width: 100%;
	height: 100%;
}
`;

  console.log("[shumway]","Processing page:",location);
  /** @type HTMLObjectElement|HTMLEmbedElement */
  for (const obj of document.querySelectorAll('object[type="application/x-shockwave-flash"], embed[type="application/x-shockwave-flash"]')) {
    console.log("[shumway]",obj);
    /** @type HTMLElement */
    const parent = obj.parentNode;

    /** @type HTMLDivElement */
    const frameHost = document.createElement("div");
    /** @type ShadowRoot */
    const shadowRoot = frameHost.attachShadow({mode:"closed"});
    {
      /** @type HTMLStyleElement */
      const styleElement = document.createElement("style");
      styleElement.textContent = STYLE;
      styleElement.type = "text/css";
      shadowRoot.appendChild(styleElement);
    }

    /** @type HTMLIFrameElement */
    const frame = document.createElement("iframe");
    shadowRoot.appendChild(frame);
    frame.addEventListener("load", async evt => {
      frame.contentWindow.postMessage({
        type: "swf",
        startupInfo: StartupInfo.getStartupInfo(obj)
      }, '*');
    });
    frame.setAttribute("frameborder", 0);
    frame.setAttribute("sandbox", "allow-scripts");
    frame.style.display = "block";
    frame.style.overflow = "hidden";
    frame.style.lineHeight = 0;
    frame.style.border = "none";
	  frame.style.width = "100%";
	  frame.style.height = "100%";
    frame.src = browser.extension.getURL("content/shumway.xhtml");

    // copy element attributes
    if (obj.hasAttribute("id"))        frameHost.setAttribute("id",        obj.getAttribute("id"));
    if (obj.hasAttribute("className")) frameHost.setAttribute("className", obj.getAttribute("className"));
    if (obj.hasAttribute("draggable")) frameHost.setAttribute("draggable", obj.getAttribute("draggable"));
    if (obj.hasAttribute("dir"))       frameHost.setAttribute("dir",       obj.getAttribute("dir"));
    if (obj.hasAttribute("tabIndex"))  frameHost.setAttribute("tabIndex",  obj.getAttribute("tabIndex"));
    if (obj.hasAttribute("width"))     frameHost.style.width  = `${Number(obj.getAttribute("width"))}px`;
    if (obj.hasAttribute("height"))    frameHost.style.height = `${Number(obj.getAttribute("height"))}px`;
    if (obj.hasAttribute("align"))     frameHost.setAttribute("align",     obj.getAttribute("align"));
    if (obj.hasAttribute("style"))     frameHost.setAttribute("style",     obj.getAttribute("style"));
    if (obj.hasAttribute("title"))     frameHost.setAttribute("title",     obj.getAttribute("title"));
    if (obj.hasAttribute("lang"))      frameHost.setAttribute("lang",      obj.getAttribute("lang"));
    if (obj.hasAttribute("hidden"))    frameHost.setAttribute("hidden",    obj.getAttribute("hidden"));

/*    if (obj.hasAttribute("width") || obj.hasAttribute("height")) {
      /** @type HTMLStyleElement */
/*      const styleElement = document.createElement("style");
      styleElement.textContent = `
:host {
  width: ${Number(obj.getAttribute("width"))}px;
  height: ${Number(obj.getAttribute("height"))}px;
}
`;
      styleElement.type = "text/css";
      shadowRoot.appendChild(styleElement);*
      frameHost.style.width = `${obj.getAttribute("width")}px`;
    }*/

    parent.replaceChild(frameHost,obj);
    console.log("[shumway]",frame,parent);
  }
})();
