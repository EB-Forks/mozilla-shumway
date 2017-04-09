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

var startupInfo;
var shumwayActions;

/**
 * The non-browser specific extension address.
 * @type {String}
 * @author ExE Boss
 */
const extension_url = window.location.protocol + "//" + window.location.host + '/';

/**
 * Converts a relative path within an add-on's install directory to a fully-qualified URL.
 *
 * @param {String} path The path, relative to manifest.json.
 * @return {String} The same result as calling <a href="https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/extension/getURL">
 * <code>browser.extension.getURL(path)</code></a>.
 * @see <a href="https://developer.mozilla.org/en-US/Add-ons/WebExtensions/API/extension/getURL">
 * <code>browser.extension.getURL(path)</code></a>
 * @author ExE Boss
 */
function getURL(path) {
  if (path.charAt(0) === '/')
    path = path.slice(1);

  return extension_url + path;
}

function parseQueryString(qs) {
  if (!qs)
    return {};

  if (qs.charAt(0) === '?')
    qs = qs.slice(1);

  var values = qs.split('&');
  var obj = {};
  for (var i = 0; i < values.length; i++) {
    var kv = values[i].split('=');
    var key = kv[0], value = kv[1];
    obj[decodeURIComponent(key)] = decodeURIComponent(value);
  }

  return obj;
}

function getViewerID() {
  var params = parseQueryString(window.location.search);
  return params.id;
}

var id = getViewerID();
var frame = document.getElementById("viewer");
console.log(frame);
var swfFunc;
var promise = new Promise((resolve) => {
  swfFunc = resolve;
}).then((data) => {
  startupInfo = data.startupInfo;
  startupInfo.window = window.parent;
  let fakeEmbedTag = document.createElement('object');
  fakeEmbedTag.data = data.swf;
  fakeEmbedTag.type = "application/x-shockwave-flash";
  startupInfo.embedTag = fakeEmbedTag;

  window.shumwayStartupInfo = startupInfo;
  shumwayActions = ShumwayCom.createActions(startupInfo, window, document);

  frame.setAttribute("src", getURL("content/web/viewer.html?swf=" + data.swf));
  console.log(frame);
  setupHandler(frame);
});

window.addEventListener("message", (event) => {
  console.log(event);
  let data = event.data;
  if (event.source === window.parent && data.type === "swf") {
    swfFunc(data);
    swfFunc = undefined;
  }
});
console.log("window.addEventListener(\"message\", (event) => {...})");
window.parent.postMessage({
  type: "frameLoaded",
  frameIndex: id
}, '*');

/**
 * @returns {Function} The function which generates the startupInfo wrapper
 */
function getEnvironment() { return {
    swfUrl: window.shumwayStartupInfo.url,
    privateBrowsing: window.shumwayStartupInfo.privateBrowsing
  };
}

/**
 * @returns {undefined}
 */
function enableDebug() {
  console.warn("TODO:", "enableDebug()");
//  DebugUtils.enableDebug(window.shumwayStartupInfo.url);
//  setTimeout(function () {
//    window.top.location.reload();
//  }, 1000);
}

/**
 * @param {HTMLIFrameElement} viewer
 * @returns {undefined}
 */
function setupHandler(viewer) {
  function sendMessage(action, data, sync) {
    var result = shumwayActions.invoke(action, data);
    return cloneInto(result, childWindow);
  }

  var childWindow = viewer.contentWindow.wrappedJSObject;

  var shumwayComAdapterHooks = {};
  ShumwayCom.createAdapter(childWindow, {
    sendMessage: sendMessage,
    enableDebug: enableDebug,
    getEnvironment: getEnvironment
  }, shumwayComAdapterHooks);

  shumwayActions.onExternalCallback = function (call) {
    return shumwayComAdapterHooks.onExternalCallback(cloneInto(call, childWindow));
  };

  shumwayActions.onLoadFileCallback = function (args) {
    shumwayComAdapterHooks.onLoadFileCallback(cloneInto(args, childWindow));
  };

  childWindow.runViewer();
}
