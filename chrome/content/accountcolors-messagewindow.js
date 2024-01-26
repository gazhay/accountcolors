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

  /* On Unload */

  onUnload: function () {
    if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
      window.document.getElementById("messagepane").removeEventListener("load", accountColorsAboutMessage.messageWindow, true);
      accountColorsAboutMessage.messageWindow(null, true); // Clear colors during unload.
    }
  },

  /* On Load */

  onLoad: function () {
    window.removeEventListener("load", accountColorsMessage.onLoad, false);

    // Since thunderbird 103, the message window is handled by about:message (can be accessed via window.messageBrowser.contentWindow)
    if (accountColorsUtilities.thunderbirdVersion.major <= 102) {
      /* Add listeners for Message Window */
      window.document.getElementById("messagepane").addEventListener("load", accountColorsAboutMessage.messageWindow, true);

      /* Initial call for Message Window */
      accountColorsAboutMessage.messageWindow();
    }
  },

  cmdOptions: function () {
    var optionsWindow;

    optionsWindow = accountColorsMessage.winmed.getMostRecentWindow("accountcolors-options");

    if (optionsWindow) optionsWindow.focus();
    else window.openDialog("chrome://accountcolors/content/accountcolors-options.xhtml", "", "chrome,dialog,titlebar,centerscreen", null);
  },
};
