/*
 * Copyright 2018 Mozilla Foundation
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
"use strict";
/* global browser */

const StartupInfo = (() => {
  const flashUnescape = (s) => {
    return decodeURIComponent(s.split('+').join(' '));
  };

  /**
   * Parse a query string
   *
   * @param {String} qs The query string.
   * @returns {Object} The parsed query string.
   */
  const parseQueryString = (qs) => {
    if (!qs)
      return {};

    if (qs.charAt(0) === '?')
      qs = qs.slice(1);

    const values = qs.split('&');
    const obj = {};
    for (const pair of qs.split('&')) {
      const splitIndex = pair.indexOf('=');
      if (splitIndex < 0) {
        continue; // skipping invalid values
      }
      obj[flashUnescape(pair.substring(0, splitIndex))] = flashUnescape(pair.substring(splitIndex + 1));
    }

    return obj;
  };

  /**
   * @param {Window} win The window to check.
   * @@returns {Boolean} If the window is private.
   */
  const isContentWindowPrivate = (win) => {
    return browser.extension.inIncognitoContext;
  };

  const isStandardEmbedWrapper = (embedElement) => {
    try {
      if (embedElement.tagName !== 'EMBED') {
        return false;
      }
      const swfUrl = embedElement.src;
      const document = embedElement.ownerDocument;
      const docUrl = document.location.href;
      if (swfUrl !== docUrl) {
        return false; // document URL shall match embed src
      }
      if (document.body.children.length !== 1 ||
        document.body.firstChild !== embedElement) {
        return false; // not the only child
      }
      if (document.defaultView.top !== document.defaultView) {
        return false; // not a top window
      }
      // Looks like a standard wrapper
      return true;
    } catch (e) {
      // Declare that is not a standard fullscreen plugin wrapper for any error
      return false;
    }
  };

  /**
   * Check if the website is allowing script access from the SWF origin
   *
   * @param	{String?}	allowScriptAccessParameter The type to allow, defaults to sameDomain
   * @param	{String}	url	SWF origin
   * @param	{String}	pageUrl	Embedding website origin
   *
   * @return	{Boolean} true if script access is allowed, false otherwise
   */
  const isScriptAllowed = (allowScriptAccessParameter, url, pageUrl) => {
    if (!allowScriptAccessParameter) {
      allowScriptAccessParameter = 'sameDomain';
    }
    let allowScriptAccess = false;
    switch (allowScriptAccessParameter.toLowerCase()) { // ignoring case here
      case 'always':
        allowScriptAccess = true;
        break;
      case 'never':
        allowScriptAccess = false;
        break;
      default: // 'sameDomain'
        if (!pageUrl)
          break;
        try {
          // checking if page is in same domain (? same protocol and port)
          allowScriptAccess = (new URL(url, pageUrl).origin === new URL(pageUrl).origin);
        } catch (ex) {}
        break;
    }
    return allowScriptAccess;
  };

  /**
   * @typedef {Object} StartupInfo A startup info object.
   * @property {Window} window The window of the element.
   * @property {String} url The URL of the flash object.
   * @property {Boolean} privateBrowsing If we are in private browsing mode.
   * @property {Object} objectParams
   * @property {Object} movieParams
   * @property {String} baseUrl The URL of something.
   * @property {Boolean} isOverlay If we are in an overlay.
   * @property {String} [refererUrl] The referrer URL.
   * @property {Element} embedTag The embedding tag.
   * @property {Number} initStartTime The creation time of this StartupInfo object.
   * @property {Boolean} allowScriptAccess If scripts are allowed access to the embedding document.
   * @property {Number} pageIndex
   */
  /**
   * Gets the startup info for the current object.
   *
   * @param {Element} element
   * @return {StartupInfo}
   */
  const getStartupInfo = (element) => {
    const initStartTime = Date.now();
    const objectParams = {
      allowscriptaccess: undefined,
      base: undefined,
      flashvars: undefined
    };
    const isOverlay = false;
    let baseUrl;
    let pageUrl;
    let url;

    /** @type String */
    pageUrl = element.ownerDocument.location.href; // proper page url?

    const tagName = element.nodeName.toUpperCase();
    if (tagName === 'EMBED') {
      url = new URL(element.src, pageUrl).href;
      for (let i = 0; i < element.attributes.length; ++i) {
        const paramName = element.attributes[i].localName.toLowerCase();
        objectParams[paramName] = element.attributes[i].value;
      }
    } else {
      url = new URL(element.data, pageUrl).href;
      for (var i = 0; i < element.childNodes.length; ++i) {
        const paramElement = element.childNodes[i];
        if (paramElement.nodeType !== 1 ||
          paramElement.nodeName.toUpperCase() !== 'PARAM') {
          continue;
        }
        var paramName = paramElement.getAttribute('name').toLowerCase();
        objectParams[paramName] = paramElement.getAttribute('value');
      }
    }

    baseUrl = pageUrl;
    if (objectParams.base) {
      try {
        // Verifying base URL, passed in object parameters. It shall be okay to
        // ignore bad/corrupted base.
        const parsedPageUrl = new URL(pageUrl);
        baseUrl = new URL(objectParams.base, parsedPageUrl).href;
      } catch (e) { /* it's okay to ignore any exception */ }
    }

    var movieParams = {};
    if (objectParams.flashvars) {
      movieParams = parseQueryString(objectParams.flashvars);
    }
    const queryStringMatch = url && /\?([^#]+)/.exec(url);
    if (queryStringMatch) {
      const queryStringParams = parseQueryString(queryStringMatch[1]);
      for (const i in queryStringParams) {
        if (!(i in movieParams)) {
          movieParams[i] = queryStringParams[i];
        }
      }
    }

    const allowScriptAccess = !!url &&
      isScriptAllowed(objectParams.allowscriptaccess, url, pageUrl);
    const isFullscreenSwf = isStandardEmbedWrapper(element);

    const document = element.ownerDocument;
    const window = document.defaultView;

    return {
      window: null,
      url,
      privateBrowsing: isContentWindowPrivate(window),
      objectParams,
      movieParams,
      baseUrl: baseUrl || url,
      isOverlay,
      refererUrl: !isFullscreenSwf ? baseUrl : null,
      embedTag: null,
      initStartTime,
      allowScriptAccess,
      pageIndex: 0
    };
  };

  return {
    getStartupInfo,
    parseQueryString,
    isContentWindowPrivate
  };
})();
