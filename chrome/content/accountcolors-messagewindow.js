/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  Message Window     */
/*                                                                      */
/*      Javascript for Message Window overlay                           */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

"use strict";

var accountColorsMessage = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  winmed: Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator),

  /* Listen for changes to settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsMessage.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsMessage.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      var element;

      if (topic != "nsPref:changed") return;

      /* Update Message Pane & Message Tab */

      accountColorsMessage.messageWindow(accountColorsMessage.getMessageWindow(), false);
    },
  },

  /* Get messsage window */
  getMessageWindow() {
    if (accountColorsUtilities.thunderbirdVersion.major >= 115) {
      return window.messageBrowser.contentWindow; // about:message
    } else {
      return window;
    }
  },

  /* On Unload */

  onUnload: function () {
    var messageWindow = accountColorsMessage.getMessageWindow();
    accountColorsMessage.prefsObserver.unregister();
    messageWindow.document.getElementById("messagepane").removeEventListener("load", accountColorsMessage.messageWindow, true);
    accountColorsMessage.messageWindow(messageWindow, true); // Clear colors during unload.
  },

  /* On Load */

  onLoad: function () {
    var messageWindow = accountColorsMessage.getMessageWindow();

    window.removeEventListener("load", accountColorsMessage.onLoad, false);

    /* Register preferences observer */

    accountColorsMessage.prefsObserver.register();

    /* Add listeners for Message Window */

    messageWindow.document.getElementById("messagepane").addEventListener("load", function(event) { accountColorsMessage.messageWindow(messageWindow, false); }, true);

    /* Initial call for Message Window */

    accountColorsMessage.messageWindow(messageWindow, true);
  },

  /* Message Window */

  messageWindow: function (window, clear) {
    var document = window.document;
    var msgHdr, accountkey, account, accountidkey, folder, server;
    var element, fontcolor, bkgdcolor, fontstyle, style, weight, fontsize;

    if (window.gMessage != null) msgHdr = window.gMessage; /* if message already displayed, thunderbird 115+ */
    else if (window.gFolderDisplay != null) msgHdr = window.gFolderDisplay.selectedMessage; /* if message already displayed */
    else if (!!window.arguments && !!window.arguments[0] && "wrappedJSObject" in window.arguments[0]) msgHdr = window.arguments[0].wrappedJSObject.msgHdr;
    else if (!!window.arguments && window.arguments[0] instanceof Components.interfaces.nsIMsgDBHdr) msgHdr = window.arguments[0];
    else return;

    /* Color based on received account */

    if (accountColorsMessage.prefs.getBoolPref("message-hdraccount")) {
      /* color using account in message header */
      accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
      account = accountColorsMessage.accountManager.getAccount(accountkey);

      if (account == null) accountidkey = null; /* sent message */
      else if (account.defaultIdentity == null) accountidkey = account.key;
      else accountidkey = account.defaultIdentity.key;
    } /* color using account in which folder is located */ else {
      folder = msgHdr.folder;
      server = folder.server;
      account = accountColorsMessage.accountManager.FindAccountForServer(server);

      if (account.defaultIdentity == null) accountidkey = account.key;
      else accountidkey = account.defaultIdentity.key;
    }

    // Use an empty id to cause color clearing.
    if (clear) {
      accountidkey = "";
    }

    /* Color subject font */

    if (accountColorsMessage.prefs.getBoolPref("message-colorfont")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      document.getElementById("expandedsubjectBox").style.color = fontcolor;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.color = fontcolor;

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.color = fontcolor;
    } else {
      document.getElementById("expandedsubjectBox").style.color = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.color = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.color = "";
    }

    /* Color header background */

    if (accountColorsMessage.prefs.getBoolPref("message-colorbkgd")) {
      bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
      if (accountColorsMessage.prefs.getBoolPref("message-defaultbkgd") && bkgdcolor == "#FFFFFF") bkgdcolor = "";

      element = document.getElementById("expandedHeaderView"); // Removed since TB 102+
      if (element != null) element.style.backgroundColor = bkgdcolor;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsedHeaderView");
      if (element != null) element.style.backgroundColor = bkgdcolor;
    } else {
      element = document.getElementById("expandedHeaderView");
      if (element != null) element.style.backgroundColor = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsedHeaderView");
      if (element != null) element.style.backgroundColor = "";
    }

    /* Color from font */

    if (accountColorsMessage.prefs.getBoolPref("message-colorfrom")) {
      fontcolor = accountColorsUtilities.fontColorPref(accountidkey);

      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]); // expandedfromBox.children[0] becomes fromHeading span in newer TB version
      element.children[0].style.color = fontcolor;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.color = fontcolor;

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.color = fontcolor;
    } else {
      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]);
      element.children[0].style.color = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.color = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.color = "";
    }

    /* Black/White header labels */

    if (accountColorsMessage.prefs.getBoolPref("message-blackhdrlabels")) {
      document.getElementById("expandedfromLabel").style.color = "black";
      document.getElementById("expandedsubjectLabel").style.color = "black";
      document.getElementById("expandedtoLabel").style.color = "black";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.children[1].children[0].style.color = "black";
        element.children[0].style.color = "black";
      } else {
        element.children[0].children[0].style.color = "black";
        element.children[1].style.color = "black";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "black";

      document.getElementById("header-view-toolbar").style.color = "black";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "black";
    } else if (accountColorsMessage.prefs.getBoolPref("message-whitehdrlabels")) {
      document.getElementById("expandedfromLabel").style.color = "white";
      document.getElementById("expandedsubjectLabel").style.color = "white";
      document.getElementById("expandedtoLabel").style.color = "white";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.children[1].children[0].style.color = "white";
        element.children[0].style.color = "white";
      } else {
        element.children[0].children[0].style.color = "white";
        element.children[1].style.color = "white";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "white";

      document.getElementById("header-view-toolbar").style.color = "white";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "white";
    } else {
      document.getElementById("expandedfromLabel").style.color = "";
      document.getElementById("expandedsubjectLabel").style.color = "";
      document.getElementById("expandedtoLabel").style.color = "";

      element = document.getElementById("expandedtoBox");
      if (element.children[0].id == "toHeading") { // expandedtoBox.children[0] becomes toHeading span in newer TB version
        element.children[1].children[0].style.color = "";
        element.children[0].style.color = "";
      } else {
        element.children[0].children[0].style.color = "";
        element.children[1].style.color = "";
      }

      element = document.getElementById("dateValueBox"); // Removed since TB 102+
      if (element != null) element.style.color = "";

      document.getElementById("header-view-toolbar").style.color = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LdateBox");
      if (element != null) element.style.color = "";
    }

    /* Subject font style */

    if (accountColorsMessage.prefs.getBoolPref("message-setfontstyle")) {
      fontstyle = accountColorsMessage.prefs.getIntPref("message-fontstyle");

      switch (fontstyle) {
        case 0 /* Normal */:
          style = "normal";
          weight = "normal";
          break;
        case 1 /* Italic */:
          style = "italic";
          weight = "normal";
          break;
        case 2 /* Bold */:
          style = "normal";
          weight = "bold";
          break;
        case 3 /* Bold Italic */:
          style = "italic";
          weight = "bold";
          break;
      }

      document.getElementById("expandedsubjectBox").style.fontStyle = style;
      document.getElementById("expandedsubjectBox").style.fontWeight = weight;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";
    } else {
      document.getElementById("expandedsubjectBox").style.fontStyle = "";
      document.getElementById("expandedsubjectBox").style.fontWeight = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontStyle = "";
      if (element != null) element.style.fontWeight = "";
    }

    /* Subject font size */

    if (accountColorsMessage.prefs.getBoolPref("message-setfontsize")) {
      fontsize = accountColorsMessage.prefs.getIntPref("message-fontsize");

      document.getElementById("expandedsubjectBox").style.fontSize = fontsize + "px";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontSize = fontsize + "px";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontSize = fontsize + "px";
    } else {
      document.getElementById("expandedsubjectBox").style.fontSize = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LsubjectBox");
      if (element != null) element.style.fontSize = "";

      element = document.getElementById("CompactHeader_collapsed2LsubjectBox");
      if (element != null) element.style.fontSize = "";
    }

    /* From font style */

    if (accountColorsMessage.prefs.getBoolPref("message-setfromstyle")) {
      fontstyle = accountColorsMessage.prefs.getIntPref("message-fromstyle");

      switch (fontstyle) {
        case 0 /* Normal */:
          style = "normal";
          weight = "normal";
          break;
        case 1 /* Italic */:
          style = "italic";
          weight = "normal";
          break;
        case 2 /* Bold */:
          style = "normal";
          weight = "bold";
          break;
        case 3 /* Bold Italic */:
          style = "italic";
          weight = "bold";
          break;
      }

      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]);
      element.children[0].style.fontStyle = style;
      element.children[0].style.fontWeight = weight;

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = style;
      if (element != null) element.children[0].children[0].style.fontWeight = weight;

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = style;
      if (element != null) element.children[0].children[0].style.fontWeight = weight;
    } else {
      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]);
      element.children[0].style.fontStyle = "";
      element.children[0].style.fontWeight = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = "";
      if (element != null) element.children[0].children[0].style.fontWeight = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontStyle = "";
      if (element != null) element.children[0].children[0].style.fontWeight = "";
    }

    /* From font size */

    if (accountColorsMessage.prefs.getBoolPref("message-setfromsize")) {
      fontsize = accountColorsMessage.prefs.getIntPref("message-fromsize");

      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]);
      element.children[0].style.fontSize = fontsize + "px";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = fontsize + "px";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = fontsize + "px";
    } else {
      element = document.getElementById("expandedfromBox");
      element = (element.children[0].id == "fromHeading" ? element.children[1] : element.children[0]);
      element.children[0].style.fontSize = "";

      /* For CompactHeader add-on */

      element = document.getElementById("CompactHeader_collapsed1LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = "";

      element = document.getElementById("CompactHeader_collapsed2LfromBox");
      if (element != null) element.children[0].children[0].style.fontSize = "";
    }
  },

  cmdOptions: function () {
    var optionsWindow;

    optionsWindow = accountColorsMessage.winmed.getMostRecentWindow("accountcolors-options");

    if (optionsWindow) optionsWindow.focus();
    else window.openDialog("chrome://accountcolors/content/accountcolors-options.xhtml", "", "chrome,dialog,titlebar,centerscreen", null);
  },
};
