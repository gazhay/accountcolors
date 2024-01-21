/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  3Pane Window       */
/*                                                                      */
/*      Javascript for 3Pane Window overlay                             */
/*                                                                      */
/*      Copyright (C) 2008-2020  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Changes in Thunderbird 68.0                                         */
/*                                                                      */
/*  Overview of changes:                                                */
/*                                                                      */
/*    - https://developer.thunderbird.net/add-ons/tb68/changes          */
/*                                                                      */
/*  Reference for removed nsITreeBoxObject interface:                   */
/*                                                                      */
/*    - https://developer.mozilla.org/en-US/docs/Mozilla/Tech/          */
/*              XPCOM/Reference/Interface/nsITreeBoxObject              */
/*                                                                      */
/************************************************************************/

/************************************************************************/
/*                                                                      */
/*  Color Received Messages by Identity instead of Account:             */
/*                                                                      */
/*  Could easily change getAccountKey() to getIdentityKey() and then    */
/*  color font and background in thread pane and message pane using     */
/*  identity instead of account.  In essence, getIdentityKey() would    */
/*  ignore msgHdr.accountKey and just search for matching identity.     */
/*                                                                      */
/************************************************************************/

"use strict";

var accountColorsMessenger = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  mailPrefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("mail."),

  otherPrefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch),

  obs: Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService),

  hdr: Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  winmed: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),

  messenger: window.top && window.top.messenger || window.messenger,

  folderTree: window.folderTree || document.getElementById("folderTree"),

  threadTree: window.threadTree || document.getElementById("threadTree"),

  /* Listen for changes to account colors settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsMessenger.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsMessenger.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      var element;

      if (topic != "nsPref:changed") return;

      /* Generate CSS tree coloring rules */

      accountColorsMessenger.generateRules();

      /* Update Folder Pane */

      accountColorsMessenger.folderPane();

      element = accountColorsMessenger.folderTree; /* Force re-load of Folder Tree */
      element.invalidate();

      element = accountColorsMessenger.folderTree; /* Causes CSS Folder Tree -moz-tree-row height change to take effect */
      element.style.visibility = "hidden";
      element.style.visibility = "";

      /* Update Thread Pane */

      accountColorsMessenger.threadPane();

      element = accountColorsMessenger.threadTree; /* Force re-load of Thread Tree */
      element.invalidate();

      element = accountColorsMessenger.threadTree; /* Causes CSS Thread Tree -moz-tree-row height change to take effect */
      element.style.visibility = "hidden";
      element.style.visibility = "";

      /* Update Message Pane & Message Tab */

      accountColorsMessenger.messagePane();
    },
  },

  /* Listen for changes to mail settings - to detect add/remove account */

  mailPrefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsMessenger.mailPrefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsMessenger.mailPrefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") return;

      /* Validate coloring preferences */

      accountColorsMessenger.validatePrefs();
    },
  },

  /* On Unload */

  onUnload: function () {
    accountColorsMessenger.prefsObserver.unregister();
    accountColorsMessenger.mailPrefsObserver.unregister();

    accountColorsMessenger.messagePaneManager.onUnload();
    accountColorsMessenger.threadPaneManager.onUnload();
    accountColorsMessenger.folderPaneManager.onUnload();

    // Clear on unload.
    accountColorsMessenger.messagePane(null, true);
  },

  /* On Load */

  onLoad: function () {
    /* Wait for Thunderbird to finish parsing CSS style sheets and initializing folder tree */

    window.setTimeout(checkReady, 10, 0);

    function checkReady(retry) {
      var i, ready, sheet, count, row;

      ready = false;

      try {
        for (i = 0; i < document.styleSheets.length; i++) {
          if (document.styleSheets[i].href == "chrome://accountcolors-skin/content/accountcolors-messengerwindow-generated.css") {
            sheet = document.styleSheets[i];
          }
        }

        count = sheet.cssRules.length; /* throws exception if parsing of CSS not complete */

        row = gFolderTreeView.getIndexOfFolder(gFolderTreeView.getSelectedFolders()[0]); /* throws exception if folder tree not initialized */

        ready = true;
      } catch (e) {
        if (retry < 5) {
          window.setTimeout(checkReady, 20, retry + 1);
        } else {
          console.error(e);
        }
      }

      if (ready)
        window.setTimeout(function () {
          accountColorsMessenger.initializePanes();
        }, 0); /* break execution */
    }
  },

  /* Initialize Folder/Thread/Message Panes */

  initializePanes: function () {
    var row;

    /* Validate coloring preferences */

    accountColorsMessenger.validatePrefs();

    /* Generate CSS tree coloring rules */

    accountColorsMessenger.generateRules();

    /* Register preferences observers */

    accountColorsMessenger.prefsObserver.register();

    accountColorsMessenger.mailPrefsObserver.register();

    /* Setup for Folder/Thread Panes */

    accountColorsMessenger.folderPaneManager.onLoad();

    accountColorsMessenger.threadPaneManager.onLoad();

    accountColorsMessenger.messagePaneManager.onLoad();

    /* Initial calls for Folder/Thread/Message Panes */

    accountColorsMessenger.folderPane();

    accountColorsMessenger.threadPane();

    accountColorsMessenger.messagePane();

    /* Selecting folder in folder pane forces coloring of thread pane */
    /* Selecting top and bottom folders in folder pane forces coloring of all of folder pane */

    if (gFolderTreeView._rowMap.length) {
      row = gFolderTreeView.getIndexOfFolder(gFolderTreeView.getSelectedFolders()[0]);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[gFolderTreeView._rowMap.length - 1]._folder);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[0]._folder);
      gFolderTreeView.selectFolder(gFolderTreeView._rowMap[row]._folder);
    }
  },

  /* Validate account/identity font and background coloring preferences */

  validatePrefs: function () {
    var index, acc, account, id, identity, accountkey, identitykey;
    var accounts = new Array();
    var identities = new Array();
    var accountsprefs = new Array();
    var identitiesprefs = new Array();

    /* Add coloring preferences for added account */

    index = 0;

    accounts = accountColorsMessenger.accountManager.accounts;

    for (acc = 0; acc < accountColorsUtilities.getLength(accounts); acc++) {
      account = accountColorsUtilities.getAccount(accounts, acc);

      identities = account.identities;

      if (accountColorsUtilities.getLength(identities) == 0) {
        /* Local Folders account or Blogs & Newsfeeds account */
        if (!accountColorsMessenger.prefs.prefHasUserValue(account.key + "-fontcolor") || !accountColorsMessenger.prefs.prefHasUserValue(account.key + "-bkgdcolor")) {
          accountColorsMessenger.prefs.setCharPref(account.key + "-fontcolor", "");
          accountColorsMessenger.prefs.setCharPref(account.key + "-bkgdcolor", "");
        }

        index++;
      } else {
        for (id = 0; id < accountColorsUtilities.getLength(identities); id++) {
          identity = accountColorsUtilities.getIdentity(identities, id);

          if (!accountColorsMessenger.prefs.prefHasUserValue(identity.key + "-fontcolor") || !accountColorsMessenger.prefs.prefHasUserValue(identity.key + "-bkgdcolor")) {
            accountColorsMessenger.prefs.setCharPref(identity.key + "-fontcolor", "");
            accountColorsMessenger.prefs.setCharPref(identity.key + "-bkgdcolor", "");
          }

          index++;
        }
      }
    }

    /* Remove coloring preferences for removed account */

    accountsprefs = accountColorsMessenger.prefs.getChildList("account", {});

    for (acc = 0; acc < accountsprefs.length; acc++) {
      accountkey = accountsprefs[acc].substr(0, accountsprefs[acc].indexOf("-"));

      if (!accountColorsMessenger.mailPrefs.prefHasUserValue("account." + accountkey + ".server") || accountColorsMessenger.mailPrefs.prefHasUserValue("account." + accountkey + ".identities")) {
        accountColorsMessenger.prefs.clearUserPref(accountkey + "-fontcolor");
        accountColorsMessenger.prefs.clearUserPref(accountkey + "-bkgdcolor");
      }
    }

    identitiesprefs = accountColorsMessenger.prefs.getChildList("id", {});

    for (id = 0; id < identitiesprefs.length; id++) {
      identitykey = identitiesprefs[id].substr(0, identitiesprefs[id].indexOf("-"));

      if (!accountColorsMessenger.mailPrefs.prefHasUserValue("identity." + identitykey + ".useremail")) {
        accountColorsMessenger.prefs.clearUserPref(identitykey + "-fontcolor");
        accountColorsMessenger.prefs.clearUserPref(identitykey + "-bkgdcolor");
      }
    }
  },

  /* Generate CSS coloring rules for folderTree and threadTree */

  generateRules: function () {
    var i, sheet, color;
    var children = new Array();

    for (i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].href == "chrome://accountcolors-skin/content/accountcolors-messengerwindow-generated.css") {
        sheet = document.styleSheets[i];
      }
    }

    while (sheet.cssRules.length > 0) sheet.deleteRule(0);

    children = accountColorsMessenger.prefs.getChildList("account", {});

    for (i = 0; i < children.length; i++) {
      color = accountColorsMessenger.prefs.getCharPref(children[i]).substr(1);

      if (children[i].substr(children[i].length - 9) == "fontcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
      } else if (children[i].substr(children[i].length - 9) == "bkgdcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
      }
    }

    children = accountColorsMessenger.prefs.getChildList("id", {});

    for (i = 0; i < children.length; i++) {
      color = accountColorsMessenger.prefs.getCharPref(children[i]).substr(1);

      if (children[i].substr(children[i].length - 9) == "fontcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,not-dragOn) { color: #" + color + " !important; }", sheet.cssRules.length); /* !important necessary to override new mail font color in Dark Theme */
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-cell-text(ac-fc-" + color + ",not-selected,untagged) { color: #" + color + " !important; }", sheet.cssRules.length); /* !important necessary to override unread message font color in Dark Theme */
      } else if (children[i].substr(children[i].length - 9) == "bkgdcolor") {
        sheet.insertRule("#folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule("#threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #folderPaneBox #folderTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected,not-dragOn) { background-color: #" + color + "; }", sheet.cssRules.length);
        sheet.insertRule(":root[lwt-tree] #threadPaneBox #threadTree treechildren::-moz-tree-row(ac-bc-" + color + ",not-selected) { background-color: #" + color + "; }", sheet.cssRules.length);
      }
    }
  },

  folderPaneManager: {
    hoverRow: null,

    dragOnRow: null,

    originalGetRowProperties: null,

    originalGetCellProperties: null,

    onLoad: function () {
      /* Detour getRowProperties and getCellProperties of gFolderTreeView */
      if (!accountColorsMessenger.folderPaneManager.originalGetRowProperties) {
        accountColorsMessenger.folderPaneManager.originalGetRowProperties = gFolderTreeView.getRowProperties;
        gFolderTreeView.getRowProperties = accountColorsMessenger.folderPaneManager.getRowProperties;
      }
      if (!accountColorsMessenger.folderPaneManager.originalGetCellProperties) {
        accountColorsMessenger.folderPaneManager.originalGetCellProperties = gFolderTreeView.getCellProperties;
        gFolderTreeView.getCellProperties = accountColorsMessenger.folderPaneManager.getCellProperties;
      }

      window.addEventListener("load", accountColorsMessenger.folderPane, false);
      accountColorsMessenger.folderTree.addEventListener("mousemove", accountColorsMessenger.folderPaneManager.onMouseMove, false);
      accountColorsMessenger.folderTree.addEventListener("dragover", accountColorsMessenger.folderPaneManager.onDragOver, false);
      accountColorsMessenger.folderTree.addEventListener("dragleave", accountColorsMessenger.folderPaneManager.onDrop, false);
      accountColorsMessenger.folderTree.addEventListener("drop", accountColorsMessenger.folderPaneManager.onDrop, false);
    },

    onUnload: function () {
      window.removeEventListener("load", accountColorsMessenger.folderPane, false);
      accountColorsMessenger.folderTree.removeEventListener("mousemove", accountColorsMessenger.folderPaneManager.onMouseMove, false);
      accountColorsMessenger.folderTree.removeEventListener("dragover", accountColorsMessenger.folderPaneManager.onDragOver, false);
      accountColorsMessenger.folderTree.removeEventListener("dragleave", accountColorsMessenger.folderPaneManager.onDrop, false);
      accountColorsMessenger.folderTree.removeEventListener("drop", accountColorsMessenger.folderPaneManager.onDrop, false);

      /* Restore getRowProperties and getCellProperties of gFolderTreeView */
      if (!!accountColorsMessenger.folderPaneManager.originalGetRowProperties) {
        gFolderTreeView.getRowProperties = accountColorsMessenger.folderPaneManager.originalGetRowProperties;
        accountColorsMessenger.folderPaneManager.originalGetRowProperties = null;
      }
      if (!!accountColorsMessenger.folderPaneManager.originalGetCellProperties) {
        gFolderTreeView.getCellProperties = accountColorsMessenger.folderPaneManager.originalGetCellProperties;
        accountColorsMessenger.folderPaneManager.originalGetCellProperties = null;
      }
    },

    onMouseMove: function (event) { /* Detect mouse hovering over row in folder or thread pane */
      accountColorsMessenger.folderPaneManager.hoverRow = this.getRowAt(event.clientX, event.clientY);
    },

    onDragOver: function (event) { /* Detect message dragged over row in folder pane */
      /* Derived from dragover event handler in tree.xml */

      var rowHeight, eventY, orientation;
      var row = {};
      var col = {};
      var child = {};

      this.getCellAt(event.clientX, event.clientY, row, col, child);

      rowHeight = this.rowHeight;
      eventY = event.clientY - this.treeBody.boxObject.y - rowHeight * (row.value - this.getFirstVisibleRow());

      if (row.value == -1) orientation = Components.interfaces.nsITreeView.DROP_ON;
      else if (eventY > rowHeight * 0.75) orientation = Components.interfaces.nsITreeView.DROP_AFTER;
      else if (eventY < rowHeight * 0.25) orientation = Components.interfaces.nsITreeView.DROP_BEFORE;
      else orientation = Components.interfaces.nsITreeView.DROP_ON;

      if (!gFolderTreeView.canDrop(row.value, orientation)) row.value = null;

      accountColorsMessenger.folderPaneManager.dragOnRow = row.value;
    },

    onDrop: function (event) {
      if (accountColorsMessenger.folderPaneManager.dragOnRow != null) {
        accountColorsMessenger.folderPaneManager.dragOnRow = null;
        gFolderTreeView._tree.invalidate();
      }
    },

    getRowProperties: function(row) {
      var props, server, account, accountidkey;
      var bkgdcolor, red, green, blue, brightness;

      if (!!accountColorsMessenger.folderPaneManager.originalGetRowProperties) {
        props = accountColorsMessenger.folderPaneManager.originalGetRowProperties.call(gFolderTreeView, row); /* call original handler */
      } else {
        props = ""
      }

      server = gFolderTreeView._rowMap[row]._folder.server;
      account = accountColorsMessenger.accountManager.FindAccountForServer(server);

      if (account.defaultIdentity == null) accountidkey = account.key;
      else accountidkey = account.defaultIdentity.key;

      /* add extra properties for not-hover, not-dragOn, not-selected, not-focused, background color, folder background color, and darker selection bar */
      /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

      if (row != accountColorsMessenger.hoverRow) {
        props += " " + "not-hover";
      }

      if (row != accountColorsMessenger.dragOnRow) {
        props += " " + "not-dragOn";
      }

      if (!gFolderTreeView.selection.isSelected(row)) {
        props += " " + "not-selected";
      }

      if (!accountColorsMessenger.folderTree.focused) {
        props += " " + "not-focused";
      }

      /* Color account/folders background */

      if ((accountColorsMessenger.prefs.getBoolPref("folder-colorbkgd") && gFolderTreeView._rowMap[row]._folder.isServer) || (accountColorsMessenger.prefs.getBoolPref("folder-colorfldbkgd") && !gFolderTreeView._rowMap[row]._folder.isServer)) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

        if (!(accountColorsMessenger.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "#FFFFFF")) {
          props += " " + "ac-bc-" + bkgdcolor.substr(1, 6);
        }
      }

      /* Darker unfocused select bar */

      if (accountColorsMessenger.prefs.getBoolPref("folder-darkerbar")) {
        props += " " + "ac-darkerbar";
      }

      return props;
    },

    getCellProperties: function(row, col) {
      var props, server, account, accountidkey;
      var fontcolor, fontstyle, fontsize;
      var bkgdcolor, red, green, blue, brightness;

      if (!!accountColorsMessenger.folderPaneManager.originalGetCellProperties) {
        props = accountColorsMessenger.folderPaneManager.originalGetCellProperties.call(gFolderTreeView, row, col); /* call original handler */
      } else {
        props = ""
      }

      server = gFolderTreeView._rowMap[row]._folder.server;
      account = accountColorsMessenger.accountManager.FindAccountForServer(server);

      if (account.defaultIdentity == null) accountidkey = account.key;
      else accountidkey = account.defaultIdentity.key;

      /* add extra properties for not-hover, not-dragOn, not-selected */
      /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

      if (row != accountColorsMessenger.hoverRow) {
        props += " " + "not-hover";
      }

      if (row != accountColorsMessenger.dragOnRow) {
        props += " " + "not-dragOn";
      }

      if (!gFolderTreeView.selection.isSelected(row)) {
        props += " " + "not-selected";
      }

      if (col.id == "folderNameCol") {
        /* add extra properties for font color, font style, font size, folder font color, no bold on unread, and show tree lines */
        /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

        if (gFolderTreeView._rowMap[row]._folder.isServer) {
          /* account folder */
          /* Color account font */

          if (accountColorsMessenger.prefs.getBoolPref("folder-colorfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            props += " " + "ac-fc-" + fontcolor.substr(1, 6);
          }

          /* Account font style */

          if (accountColorsMessenger.prefs.getBoolPref("folder-setfontstyle")) {
            fontstyle = accountColorsMessenger.prefs.getIntPref("folder-fontstyle");

            switch (fontstyle) {
              case 0 /* Normal */:
                props += " " + "ac-fs-normal";
                break;
              case 1 /* Italic */:
                props += " " + "ac-fs-italic";
                break;
              case 2 /* Bold */:
                props += " " + "ac-fs-bold";
                break;
              case 3 /* Bold Italic */:
                props += " " + "ac-fs-bolditalic";
                break;
            }
          }

          /* Account font size */

          if (accountColorsMessenger.prefs.getBoolPref("folder-setfontsize")) {
            if (accountColorsMessenger.prefs.getBoolPref("folder-incspacing")) {
              fontsize = accountColorsMessenger.prefs.getIntPref("folder-fontsize");
              props += " " + "ac-fs-" + fontsize + "-is";
            } else {
              fontsize = accountColorsMessenger.prefs.getIntPref("folder-fontsize");
              props += " " + "ac-fs-" + fontsize;
            }
          }
        } /* sub-folder */ else {
          /* Color folder font */

          if (accountColorsMessenger.prefs.getBoolPref("folder-colorfldfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            props += " " + "ac-fc-" + fontcolor.substr(1, 6);
          }

          /* No bold on Folders with unread messages */

          if (accountColorsMessenger.prefs.getBoolPref("folder-noboldunread")) {
            props += " " + "ac-noboldunread";
          }
        }

        /* Show tree lines */

        if ((accountColorsMessenger.prefs.getBoolPref("folder-colorbkgd") && gFolderTreeView._rowMap[row]._folder.isServer) || (accountColorsMessenger.prefs.getBoolPref("folder-colorfldbkgd") && !gFolderTreeView._rowMap[row]._folder.isServer)) {
          bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

          if (!(accountColorsMessenger.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "#FFFFFF")) {
            red = parseInt(bkgdcolor.substr(1, 2), 16);
            green = parseInt(bkgdcolor.substr(3, 2), 16);
            blue = parseInt(bkgdcolor.substr(5, 2), 16);

            brightness = 0.299 * red + 0.587 * green + 0.114 * blue;

            if (brightness >= 144) props += " " + "ac-blackline";
            else props += " " + "ac-whiteline";
          } else if (accountColorsMessenger.prefs.getBoolPref("folder-lightpanebkgd")) {
            props += " " + "ac-blackline";
          } else if (accountColorsMessenger.prefs.getBoolPref("folder-darkpanebkgd")) {
            props += " " + "ac-whiteline";
          }
        }
      } /* any other column */ else {
        /* add extra properties for font color */
        /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

        /* Color unread/total/size fonts */

        if (accountColorsMessenger.prefs.getBoolPref("folder-colorother")) {
          fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
          props += " " + "ac-fc-" + fontcolor.substr(1, 6);
        }
      }

      return props;
    },
  },

  folderPane: function () {
    var element, fontsize;

    /* Black/White row fonts */

    if (accountColorsMessenger.prefs.getBoolPref("folder-blackrowfont")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsMessenger.prefs.getBoolPref("folder-whiterowfont")) {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsMessenger.prefs.getBoolPref("folder-lightpanebkgd")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsMessenger.prefs.getBoolPref("folder-darkpanebkgd")) {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold on accounts/folders with new mail */

    if (accountColorsMessenger.prefs.getBoolPref("folder-boldnewmail")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-boldnewmail", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-boldnewmail");
    }

    /* Underline on accounts/folders with new mail */

    if (accountColorsMessenger.prefs.getBoolPref("folder-undernewmail")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-undernewmail", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-undernewmail");
    }

    /* Show tree lines */

    if (accountColorsMessenger.prefs.getBoolPref("folder-showlines")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-showlines", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-showlines");
    }

    /* Increase row spacing based on account font size */

    if (accountColorsMessenger.prefs.getBoolPref("folder-incspacing")) {
      fontsize = accountColorsMessenger.prefs.getIntPref("folder-fontsize");
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsMessenger.prefs.getBoolPref("folder-hoverselect")) {
      element = accountColorsMessenger.folderTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsMessenger.folderTree;
      element.removeAttribute("ac-hoverselect");
    }

    element = accountColorsMessenger.folderTree; /* Causes CSS Folder Tree -moz-tree-row height change to take effect */
    element.style.visibility = "hidden";
    element.style.visibility = "";
  },

  /* Thread Pane in Main Tab */

  threadPaneManager: {
    hoverRow: null,

    columnHandlers: new Map(),

    onLoad: function() {
      accountColorsMessenger.obs.addObserver(this, "MsgCreateDBView", false);
      accountColorsMessenger.folderTree.addEventListener("select", accountColorsMessenger.threadPane, false);
      accountColorsMessenger.threadTree.addEventListener("mousemove", accountColorsMessenger.threadPaneManager.onMouseMove, false);
    },

    onUnload: function() {
      accountColorsMessenger.folderTree.removeEventListener("select", accountColorsMessenger.threadPane, false);
      accountColorsMessenger.threadTree.removeEventListener("mousemove", accountColorsMessenger.threadPaneManager.onMouseMove, false);

      accountColorsMessenger.obs.removeObserver(this, "MsgCreateDBView");
      for (const [col, columnHandler] of this.columnHandlers.entries()) {
        gDBView.removeColumnHandler(col, columnHandler);
      }
    },

    observe: function (displayedFolder, topic, data) {
      if (topic != "MsgCreateDBView") return;

      // Register all columns
      for (const colId of gFolderDisplay.COLUMNS_MAP.keys()) {
        this.addColumnHandler(colId);
      }
      for (const colId of gFolderDisplay.COLUMNS_MAP_NOSORT.keys()) {
        this.addColumnHandler(colId);
      }
    },

    addColumnHandler(colId) {
      var columnHandler = {
        /* Thread column Handler functions for nsITreeView called from nsMsgDBView.cpp */
        /* - for getRowProperties: m_customColumnHandlers[i]->GetRowProperties(index,extra) */
        /* - for other functions: colHandler->getCellProperties(row,col,properties) */

        getRowProperties: function (row) {
          var props, msgHdr, accountkey, account, accountidkey, folder, server;
          var bkgdcolor;

          props = " ";

          msgHdr = gDBView.getMsgHdrAt(row);

          /* Color based on received account */

          if (accountColorsMessenger.prefs.getBoolPref("thread-hdraccount")) {
            /* color using account in message header */
            accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
            account = accountColorsMessenger.accountManager.getAccount(accountkey);

            if (account == null) accountidkey = null; /* sent message */
            else if (account.defaultIdentity == null) accountidkey = account.key;
            else accountidkey = account.defaultIdentity.key;
          } /* color using account in which folder is located */ else {
            folder = msgHdr.folder;
            server = folder.server;
            account = accountColorsMessenger.accountManager.FindAccountForServer(server);

            if (account.defaultIdentity == null) accountidkey = account.key;
            else accountidkey = account.defaultIdentity.key;
          }

          /* add extra properties for not-hover, not-selected, not-focused, background color, show row stripes, darker selection bar */
          /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

          if (row != accountColorsMessenger.hoverRow) {
            props += " " + "not-hover";
          }

          if (!gDBView.selection.isSelected(row)) {
            props += " " + "not-selected";
          }

          if (!accountColorsMessenger.threadTree.focused) {
            props += " " + "not-focused";
          }

          /* Color row background */

          if (accountColorsMessenger.prefs.getBoolPref("thread-colorbkgd")) {
            bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
            props += " " + "ac-bc-" + bkgdcolor.substr(1, 6);
          }

          /* Show row stripes */

          if (accountColorsMessenger.prefs.getBoolPref("thread-showstripes")) {
            props += " " + "ac-showstripes";
          }

          /* Darker unfocused select bar */

          if (accountColorsMessenger.prefs.getBoolPref("thread-darkerbar")) {
            props += " " + "ac-darkerbar";
          }

          return props;
        },

        getCellProperties: function (row, col) {
          var props, msgHdr, accountkey, account, accountidkey, folder, server, value;
          var fontcolor, fontstyle, fontsize, fromcolor, fromstyle, fromsize;

          props = " ";

          msgHdr = gDBView.getMsgHdrAt(row);

          /* Color based on received account */

          if (accountColorsMessenger.prefs.getBoolPref("thread-hdraccount")) {
            /* color using account in message header */
            accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
            account = accountColorsMessenger.accountManager.getAccount(accountkey);

            if (account == null) accountidkey = null; /* sent message */
            else if (account.defaultIdentity == null) accountidkey = account.key;
            else accountidkey = account.defaultIdentity.key;
          } /* color using account in which folder is located */ else {
            folder = msgHdr.folder;
            server = folder.server;
            account = accountColorsMessenger.accountManager.FindAccountForServer(server);

            if (account.defaultIdentity == null) accountidkey = account.key;
            else accountidkey = account.defaultIdentity.key;
          }

          /* add extra properties for not-hover and not-selected */
          /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

          if (row != accountColorsMessenger.hoverRow) {
            props += " " + "not-hover";
          }

          if (!gDBView.selection.isSelected(row)) {
            props += " " + "not-selected";
          }

          if (col.id == "subjectCol") {
            /* add extra properties for font color, font style, font size and bold subject */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color subject font */

            if (accountColorsMessenger.prefs.getBoolPref("thread-colorfont")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }

            /* Subject font style */

            if (accountColorsMessenger.prefs.getBoolPref("thread-setfontstyle")) {
              fontstyle = accountColorsMessenger.prefs.getIntPref("thread-fontstyle");

              switch (fontstyle) {
                case 0 /* Normal */:
                  props += " " + "ac-fs-normal";
                  break;
                case 1 /* Italic */:
                  props += " " + "ac-fs-italic";
                  break;
                case 2 /* Bold */:
                  props += " " + "ac-fs-bold";
                  break;
                case 3 /* Bold Italic */:
                  props += " " + "ac-fs-bolditalic";
                  break;
              }
            }

            /* Subject font size */

            if (accountColorsMessenger.prefs.getBoolPref("thread-setfontsize")) {
              if (accountColorsMessenger.prefs.getBoolPref("thread-incspacing")) {
                fontsize = accountColorsMessenger.prefs.getIntPref("thread-fontsize");
                props += " " + "ac-fs-" + fontsize + "-is";
              } else {
                fontsize = accountColorsMessenger.prefs.getIntPref("thread-fontsize");
                props += " " + "ac-fs-" + fontsize;
              }
            }

            /* Bold Subject on unread messages */

            if (accountColorsMessenger.prefs.getBoolPref("thread-boldsubject")) {
              props += " " + "ac-boldsubject";
            }
          } else if (col.id == "senderCol") {
            /* add extra properties for from color, from style, from size and bold */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color from font */

            if (accountColorsMessenger.prefs.getBoolPref("thread-colorfrom")) {
              fromcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fromcolor.substr(1, 6);
            }

            /* From font style */

            if (accountColorsMessenger.prefs.getBoolPref("thread-setfromstyle")) {
              fromstyle = accountColorsMessenger.prefs.getIntPref("thread-fromstyle");

              switch (fromstyle) {
                case 0 /* Normal */:
                  props += " " + "ac-fs-normal";
                  break;
                case 1 /* Italic */:
                  props += " " + "ac-fs-italic";
                  break;
                case 2 /* Bold */:
                  props += " " + "ac-fs-bold";
                  break;
                case 3 /* Bold Italic */:
                  props += " " + "ac-fs-bolditalic";
                  break;
              }
            }

            /* From font size */

            if (accountColorsMessenger.prefs.getBoolPref("thread-setfromsize")) {
              if (accountColorsMessenger.prefs.getBoolPref("thread-incspacing")) {
                fromsize = accountColorsMessenger.prefs.getIntPref("thread-fromsize");
                props += " " + "ac-fs-" + fromsize + "-is";
              } else {
                fromsize = accountColorsMessenger.prefs.getIntPref("thread-fromsize");
                props += " " + "ac-fs-" + fromsize;
              }
            }

            /* Bold from on unread messages */

            if (accountColorsMessenger.prefs.getBoolPref("thread-boldfrom")) {
              props += " " + "ac-boldfrom";
            }
          } else if (col.id == "correspondentCol") {
            /* add extra properties for recipient/date/size/account/etc (other) color */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Get outgoing and incoming properties - which are set in nsMsgDBView.cpp only if there is no custom column handler */
            value = accountColorsMessenger.hdr.parseDecodedHeader(msgHdr.mime2DecodedAuthor)[0].email;
            if (accountColorsMessenger.accountManager.allIdentities.some(id => id.email.toLowerCase() == value.toLowerCase())) {
              props += " " + "outgoing";
            } else {
              props += " " + "incoming";
            }

            /* Color recipient/date/size/account/etc fonts */

            if (accountColorsMessenger.prefs.getBoolPref("thread-colorother")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }
          } /* any other column */ else {
            /* add extra properties for recipient/date/size/account/etc (other) color */
            /* required to select tree element styles defined in accountcolors-messengerwindow[-generated].css */

            /* Color recipient/date/size/account/etc fonts */

            if (accountColorsMessenger.prefs.getBoolPref("thread-colorother")) {
              fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
              props += " " + "ac-fc-" + fontcolor.substr(1, 6);
            }
          }

          return props;
        },

        getCellText: function (row, col) {
          var value, msgHdr, accountkey, account;

          value = gDBView.cellTextForColumn(row, col.id); /* original handler called */

          /* Color based on received account */

          if (accountColorsMessenger.prefs.getBoolPref("thread-hdraccount")) {
            /* color using account in message header */
            if (col.id == "accountCol") {
              msgHdr = gDBView.getMsgHdrAt(row);

              accountkey = accountColorsUtilities.getAccountKey(msgHdr);
              account = accountColorsMessenger.accountManager.getAccount(accountkey);

              if (account != null) value = account.incomingServer.prettyName;
            }
          }

          return value;
        },

        getImageSrc: function (row, col) {
          return ""; /* original handler always returns null string */
        },

        cycleCell: function (row, col) {
          if (["unreadButtonColHeader", "threadCol", "tagsCol", "flaggedCol", "junkStatusCol"].includes(col.id)) { /* original handler only called for these columns */
            var value;

            gDBView.removeColumnHandler(col.id);
            value = gDBView.cycleCell(row, col); /* original handler called */
            gDBView.addColumnHandler(col.id, this);

            return value;
          }
        },

        isEditable: function (row, col) {
          return false; /* original handler always returns false */
        },

        /* Functions for nsIMsgCustomColumnHandler */

        getSortStringForRow: function (hdr) {
          return ""; /* custom handler not called for standard columns */
        },

        getSortLongForRow: function (hdr) {
          return 0; /* custom handler not called for standard columns */
        },

        isString: function () {
          return true;  /* custom handler not called for standard columns */
        },
      }

      /* Only add getRowProperties for subjectCol, as gDBView will try to call all column handlers for this function */

      if (colId != "subjectCol") {
        delete columnHandler.getRowProperties;
      }

      gDBView.addColumnHandler(colId, columnHandler);

      this.columnHandlers.set(colId, columnHandler);
    },

    onMouseMove: function (event) { /* Detect mouse hovering over row in folder or thread pane */
      accountColorsMessenger.threadPaneManager.hoverRow = this.getRowAt(event.clientX, event.clientY);
    },
  },

  threadPane: function () {
    var element, fontsize, fromsize;

    /* Black/White row fonts */

    if (accountColorsMessenger.prefs.getBoolPref("thread-blackrowfont")) {
      element = accountColorsMessenger.threadTree;
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsMessenger.prefs.getBoolPref("thread-whiterowfont")) {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsMessenger.prefs.getBoolPref("thread-lightpanebkgd")) {
      element = accountColorsMessenger.threadTree;
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsMessenger.prefs.getBoolPref("thread-darkpanebkgd")) {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold subject/from on unread messages */

    if (accountColorsMessenger.prefs.getBoolPref("thread-boldsubject") || accountColorsMessenger.prefs.getBoolPref("thread-boldfrom")) {
      element = accountColorsMessenger.threadTree;
      element.setAttribute("ac-boldsubjectfrom", "");
    } else {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-boldsubjectfrom");
    }

    /* Increase row spacing based on subject/from font sizes */

    if (accountColorsMessenger.prefs.getBoolPref("thread-incspacing")) {
      fontsize = accountColorsMessenger.prefs.getIntPref("thread-fontsize");
      fromsize = accountColorsMessenger.prefs.getIntPref("thread-fromsize");
      if (fromsize > fontsize) fontsize = fromsize;
      element = accountColorsMessenger.threadTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsMessenger.prefs.getBoolPref("thread-hoverselect")) {
      element = accountColorsMessenger.threadTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsMessenger.threadTree;
      element.removeAttribute("ac-hoverselect");
    }

    element = accountColorsMessenger.threadTree; /* Causes CSS Thread Tree -moz-tree-row height change to take effect */
    element.style.visibility = "hidden";
    element.style.visibility = "";
  },

  /* Message Pane in Main Tab */

  messagePaneManager: {
    onLoad: function () {
      document.getElementById("tabmail").addEventListener("load", accountColorsMessenger.messagePane, true);
    },

    onUnload: function () {
      document.getElementById("tabmail").removeEventListener("load", accountColorsMessenger.messagePane, true);
    },
  },

  messagePane: function(event, clear) {
    // For TB version 103 and above, the message window is handled by about:message (can be accessed via window.messageBrowser.contentWindow)
    if (accountColorsUtilities.thunderbirdVersion.major <= 102 && typeof accountColorsAboutMessage != "undefined") {
      accountColorsAboutMessage.messageWindow(event, clear);
    }
  },

  cmdOptions: function () {
    var optionsWindow;

    optionsWindow = accountColorsMessenger.winmed.getMostRecentWindow("accountcolors-options");

    if (optionsWindow) optionsWindow.focus();
    else window.openDialog("chrome://accountcolors/content/accountcolors-options.xhtml", "", "chrome,dialog,titlebar,centerscreen", null);
  },
};
