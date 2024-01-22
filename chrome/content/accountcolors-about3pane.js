/************************************************************************/
/*                                                                      */
/*      Account Colors  -  Thunderbird Extension  -  about:3pane        */
/*                                                                      */
/*      Javascript for about:3pane overlay                              */
/*                                                                      */
/*      Copyright (C) 2008-2019  by  DW-dev                             */
/*      Copyright (C) 2022-2022  by  MrMelon54                          */
/*                                                                      */
/*      Last Edit  -  15 Jul 2022                                       */
/*                                                                      */
/************************************************************************/

var accountColorsAbout3Pane = {
  prefs: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.accountcolors."),

  obs: Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService),

  hdr: Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser),

  folderLookup: Components.classes["@mozilla.org/mail/folder-lookup;1"].getService(Components.interfaces.nsIFolderLookupService),

  accountManager: Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager),

  messenger: window.top && window.top.messenger || window.messenger,

  folderTree: window.folderTree || document.getElementById("folderTree"),

  threadTree: window.threadTree || document.getElementById("threadTree"),

  /* Listen for changes to account colors settings */

  prefsObserver: {
    register: function () {
      /* Add the observer */
      this.registered = true;
      accountColorsAbout3Pane.prefs.addObserver("", this, false);
    },

    unregister: function () {
      if (!this.registered) return;

      accountColorsAbout3Pane.prefs.removeObserver("", this);
    },

    observe: function (subject, topic, data) {
      if (topic != "nsPref:changed") return;

      /* Update Folder Pane */

      accountColorsAbout3Pane.folderPane();
      accountColorsAbout3Pane.folderPaneManager.reload();

      /* Update Thread Pane */

      accountColorsAbout3Pane.threadPane();
      accountColorsAbout3Pane.threadPaneManager.reload();

      /* Update Message Pane & Message Tab */

      accountColorsAbout3Pane.messagePane();
    },
  },

  onUnload: function() {
    accountColorsAbout3Pane.folderPaneManager.onUnload();
    accountColorsAbout3Pane.threadPaneManager.onUnload();

    accountColorsAbout3Pane.prefsObserver.unregister();
  },

  onLoad: function () {
    accountColorsAbout3Pane.prefsObserver.register();

    customElements.whenDefined("folder-tree-row").then(() => {
      accountColorsAbout3Pane.folderPaneManager.onLoad();
      accountColorsAbout3Pane.folderPane();
      accountColorsAbout3Pane.folderPaneManager.reload();
    });

    Promise.all([customElements.whenDefined("thread-row"), customElements.whenDefined("thread-card")]).then(() => {
      accountColorsAbout3Pane.threadPaneManager.onLoad();
      accountColorsAbout3Pane.threadPane();
      accountColorsAbout3Pane.threadPaneManager.reload();
    });
  },

  folderPaneManager: {
    originalSetFolderPropertiesFromFolder: null,

    onUnload: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");

      if (accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        classFolderTreeRow.prototype.setFolderPropertiesFromFolder = accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder;
        delete accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder;
      }
    },

    onLoad: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");


      /* Detour FolderTreeRow.prototype.setFolderPropertiesFromFolder */

      if (!accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder = classFolderTreeRow.setFolderPropertiesFromFolder;
        classFolderTreeRow.prototype.setFolderPropertiesFromFolder = accountColorsAbout3Pane.folderPaneManager.setFolderPropertiesFromFolder;
      }
    },

    reload: function() {
      var classFolderTreeRow = customElements.get("folder-tree-row");
      var row;

      /* Reapply setFolderPropertiesFromFolder to all folder tree rows */

      for (row of accountColorsAbout3Pane.folderTree.querySelectorAll("li")) {
        if (!(row instanceof classFolderTreeRow)) {
          continue;
        }
        row.setFolderPropertiesFromFolder(accountColorsAbout3Pane.folderLookup.getFolderForURL(row.uri));
      }
    },

    /* Detour FolderTreeRow.prototype.setFolderPropertiesFromFolder */

    setFolderPropertiesFromFolder: function(folder) {
      var server, account, accountidkey;
      var fontcolor, bkgdcolor, fontstyle, fontsize, style, weight;

      /* Call original function */

      if (accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder) {
        accountColorsAbout3Pane.folderPaneManager.originalSetFolderPropertiesFromFolder.call(this, folder);
      }

      /* Set some element fields on FolderTreeView object for modifying properties */
      if (!this.container) {
        this.container = this.querySelector(".container");
      }

      server = folder.server;
      account = accountColorsAbout3Pane.accountManager.FindAccountForServer(server);

      if (account.defaultIdentity == null) accountidkey = account.key;
      else accountidkey = account.defaultIdentity.key;

      /* Color account/folders font */

      if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfont") && folder.isServer) ||
          (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldfont") && !folder.isServer)) {
        fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
        this.nameLabel.style.color = fontcolor;
      } else {
        this.nameLabel.style.color = "";
      }

      /* Color account/folders background */

      if ((accountColorsAbout3Pane.prefs.getBoolPref("folder-colorbkgd") && folder.isServer) ||
          (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorfldbkgd") && !folder.isServer)) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);

        if (!(accountColorsAbout3Pane.prefs.getBoolPref("folder-defaultbkgd") && bkgdcolor == "")) {
          this.container.style.backgroundColor = bkgdcolor;
        }
      } else {
        this.container.style.backgroundColor = "";
      }

      /* Color unread/total/size fonts */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-colorother")) {
        fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
        this.unreadCountLabel.style.color = fontcolor;
        this.totalCountLabel.style.color = fontcolor;
        this.folderSizeLabel.style.color = fontcolor;
      } else {
        this.unreadCountLabel.style.color = "";
        this.totalCountLabel.style.color = "";
        this.folderSizeLabel.style.color = "";
      }

      /* Account font style */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontstyle") && folder.isServer) {
        fontstyle = accountColorsAbout3Pane.prefs.getIntPref("folder-fontstyle");

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

        this.nameLabel.style.fontStyle = style;
        this.nameLabel.style.fontWeight = weight;
      } else {
        this.nameLabel.style.fontStyle = "";
        this.nameLabel.style.fontWeight = "";
      }

      /* Account font size */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-setfontsize") && folder.isServer) {
        fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
        // ac-fs have margin-top attribute set, we use it instead of font-size style
        if (accountColorsAbout3Pane.prefs.getBoolPref("folder-incspacing")) {
          this.nameLabel.setAttribute("ac-fs", fontsize + "-is");
        } else {
          this.nameLabel.setAttribute("ac-fs", fontsize);
        }
      } else {
        this.nameLabel.removeAttribute("ac-fs");
      }

      /* No bold on Folders with unread messages */

      if (accountColorsAbout3Pane.prefs.getBoolPref("folder-noboldunread") && !folder.isServer) {
        this.nameLabel.setAttribute("ac-noboldunread", "");
      } else {
        this.nameLabel.removeAttribute("ac-noboldunread");
      }
    },
  },

  folderPane() {
    var element, fontsize;

    /* Black/White row fonts */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-blackrowfont")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-whiterowfont")) {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-lightpanebkgd")) {
      element = document.getElementById("folderPane");
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("folder-darkpanebkgd")) {
      element = document.getElementById("folderPane");
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = document.getElementById("folderPane");
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold on accounts/folders with new mail */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-boldnewmail")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-boldnewmail", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-boldnewmail");
    }

    /* Underline on accounts/folders with new mail */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-undernewmail")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-undernewmail", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-undernewmail");
    }

    /* Show tree lines */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-showlines")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-showlines", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-showlines");
    }

    /* Increase row spacing based on account font size */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-incspacing")) {
      fontsize = accountColorsAbout3Pane.prefs.getIntPref("folder-fontsize");
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsAbout3Pane.prefs.getBoolPref("folder-hoverselect")) {
      element = accountColorsAbout3Pane.folderTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsAbout3Pane.folderTree;
      element.removeAttribute("ac-hoverselect");
    }
  },

  threadPaneManager: {
    originalThreadRowIndexSetter: null,

    originalThreadCardIndexSetter: null,

    onUnload: function() {
      var classThreadRow = customElements.get("thread-row");
      var classThreadCard = customElements.get("thread-card");

      if (accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter) {
        Object.defineProperty(classThreadRow.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter });
        delete accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter;
      }

      if (accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter) {
        Object.defineProperty(classThreadCard.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter });
        delete accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter;
      }
    },

    onLoad: function() {
      var classThreadRow = customElements.get("thread-row");
      var classThreadCard = customElements.get("thread-card");

      /* Detour ThreadRow.prototype.index setter */

      if (!accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter) {
        accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter = Object.getOwnPropertyDescriptor(classThreadRow.prototype, "index").set;
        Object.defineProperty(classThreadRow.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.threadRowIndexSetter });
      }

      /* Detour ThreadCard.prototype.index setter */

      if (!accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter) {
        accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter = Object.getOwnPropertyDescriptor(classThreadCard.prototype, "index").set;
        Object.defineProperty(classThreadCard.prototype, "index", { set: accountColorsAbout3Pane.threadPaneManager.threadCardIndexSetter });
      }
    },

    reload: function() {
      accountColorsAbout3Pane.threadTree.reset();
    },

    /* Detour ThreadRow.prototype.index setter */

    threadRowIndexSetter: function(row) {
      var msgHdr, accountkey, account, accountidkey, folder, server, element;
      var fontcolor, bkgdcolor, fontstyle, fontsize, style, weight;

      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter) {
        accountColorsAbout3Pane.threadPaneManager.originalThreadRowIndexSetter.call(this, row);
      }

      msgHdr = gDBView.getMsgHdrAt(row);

      /* Color based on received account */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount")) {
        /* color using account in message header */
        accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
        account = accountColorsAbout3Pane.accountManager.getAccount(accountkey);

        if (account == null) accountidkey = null; /* sent message */
        else if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      } /* color using account in which folder is located */ else {
        folder = msgHdr.folder;
        server = folder.server;
        account = accountColorsAbout3Pane.accountManager.FindAccountForServer(server);

        if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      }

      /* Set row properties */

      /* Color row background */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd")) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
        this.style.backgroundColor = bkgdcolor;
      }

      /* Set column properties */

      for (const column of window.threadPane.columns) {
        if (column.hidden) {
          continue;
        }

        /* Set some element fields on ThreadRow object for modifying properties */
        element = this.querySelector("." + column.id.toLowerCase() + "-column");

        if (column.id == "subjectCol") {
          /* Color subject font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          } else {
            element.style.color = "";
          }

          /* Subject font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fontstyle");

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

            element.style.fontStyle = style;
            element.style.fontWeight = weight;
          } else {
            element.style.fontStyle = "";
            element.style.fontWeight = "";
          }

          /* Subject font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold Subject on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject")) {
            element.setAttribute("ac-boldsubject", "");
          } else {
            element.removeAttribute("ac-boldsubject");
          }

          continue;
        }

        if (column.id == "senderCol") {
          /* Color from font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfrom")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          } else {
            element.style.color = "";
          }

          /* From font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fromstyle");

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

            element.style.fontStyle = style;
            element.style.fontWeight = weight;
          } else {
            element.style.fontStyle = "";
            element.style.fontWeight = "";
          }

          /* From font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold from on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
            element.setAttribute("ac-boldfrom", "");
          } else {
            element.removeAttribute("ac-boldfrom");
          }

          continue;
        }

        if (column.id == "correspondentCol") {
          /* Color recipient/date/size/account/etc fonts */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          }

          continue;
        }

        if (column.id == "accountCol") {
          /* Color recipient/date/size/account/etc fonts */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          }

          /* Color using account in message header */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount") && account != null) {
            element.textContent = account.incomingServer.prettyName;
          }

          continue;
        }

        /* any other column */

        /* Color recipient/date/size/account/etc fonts */

        if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother")) {
          fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
          element.style.color = fontcolor;
        }
      }
    },

    /* Detour ThreadCard.prototype.index setter */

    threadCardIndexSetter: function(row) {
      var msgHdr, accountkey, account, accountidkey, folder, server, element;
      var fontcolor, bkgdcolor, fontstyle, fontsize, style, weight;

      /* Call original function */

      if (accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter) {
        accountColorsAbout3Pane.threadPaneManager.originalThreadCardIndexSetter.call(this, row);
      }

      msgHdr = gDBView.getMsgHdrAt(row);

      /* Color based on received account */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hdraccount")) {
        /* color using account in message header */
        accountkey = accountColorsUtilities.getAccountKey(msgHdr); /* null string if sent message */
        account = accountColorsAbout3Pane.accountManager.getAccount(accountkey);

        if (account == null) accountidkey = null; /* sent message */
        else if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      } /* color using account in which folder is located */ else {
        folder = msgHdr.folder;
        server = folder.server;
        account = accountColorsAbout3Pane.accountManager.FindAccountForServer(server);

        if (account.defaultIdentity == null) accountidkey = account.key;
        else accountidkey = account.defaultIdentity.key;
      }

      /* Set card properties */

      /* Color card background */

      if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorbkgd")) {
        bkgdcolor = accountColorsUtilities.bkgdColorPref(accountidkey);
        this.style.backgroundColor = bkgdcolor;
      }

      for (const column of window.threadPane.cardColumns) {
        if (column == "subjectCol") {
          element = this.subjectLine;

          /* Color subject font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfont")) {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          } else {
            element.style.color = "";
          }

          /* Subject font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fontstyle");

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

            element.style.fontStyle = style;
            element.style.fontWeight = weight;
          } else {
            element.style.fontStyle = "";
            element.style.fontWeight = "";
          }

          /* Subject font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfontsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold Subject on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject")) {
            element.setAttribute("ac-boldsubject", "");
          } else {
            element.removeAttribute("ac-boldsubject");
          }

          continue;
        }

        if (column == "senderCol" || column == "dateCol") { // Sender column and Date column are in same line, so apply same font style and size is better
          element = column == "senderCol" ? this.senderLine : this.dateLine;

          /* Color from font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorfrom") && column == "senderCol") {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          } else {
            element.style.color = "";
          }

          /* Color date font */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-colorother") && column == "dateCol") {
            fontcolor = accountColorsUtilities.fontColorPref(accountidkey);
            element.style.color = fontcolor;
          } else {
            element.style.color = "";
          }

          /* From font style */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromstyle")) {
            fontstyle = accountColorsAbout3Pane.prefs.getIntPref("thread-fromstyle");

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

            element.style.fontStyle = style;
            element.style.fontWeight = weight;
          } else {
            element.style.fontStyle = "";
            element.style.fontWeight = "";
          }

          /* From font size */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-setfromsize")) {
            fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
            // ac-fs have margin-top attribute set, we use it instead of font-size style
            if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
              element.setAttribute("ac-fs", fontsize + "-is");
            } else {
              element.setAttribute("ac-fs", fontsize);
            }
          } else {
            element.removeAttribute("ac-fs");
          }

          /* Bold from on unread messages */

          if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
            element.setAttribute("ac-boldfrom", "");
          } else {
            element.removeAttribute("ac-boldfrom");
          }

          continue;
        }
      }
    },
  },

  threadPane: function () {
    var element, fontsize, fromsize;

    /* Black/White row fonts */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-blackrowfont")) {
      element = document.getElementById("threadPane");
      element.setAttribute("ac-blackrowfont", "");
      element.removeAttribute("ac-whiterowfont");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("thread-whiterowfont")) {
      element = document.getElementById("threadPane");
      element.removeAttribute("ac-blackrowfont");
      element.setAttribute("ac-whiterowfont", "");
    } else {
      element = document.getElementById("threadPane");
      element.removeAttribute("ac-blackrowfont");
      element.removeAttribute("ac-whiterowfont");
    }

    /* Light/Dark pane background */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-lightpanebkgd")) {
      element = document.getElementById("threadPane");
      element.setAttribute("ac-lightpanebkgd", "");
      element.removeAttribute("ac-darkpanebkgd");
    } else if (accountColorsAbout3Pane.prefs.getBoolPref("thread-darkpanebkgd")) {
      element = document.getElementById("threadPane");
      element.removeAttribute("ac-lightpanebkgd");
      element.setAttribute("ac-darkpanebkgd", "");
    } else {
      element = document.getElementById("threadPane");
      element.removeAttribute("ac-lightpanebkgd");
      element.removeAttribute("ac-darkpanebkgd");
    }

    /* Bold subject/from on unread messages */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-boldsubject") || accountColorsAbout3Pane.prefs.getBoolPref("thread-boldfrom")) {
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-boldsubjectfrom", "");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-boldsubjectfrom");
    }

    /* Increase row spacing based on subject/from font sizes */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-incspacing")) {
      fontsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fontsize");
      fromsize = accountColorsAbout3Pane.prefs.getIntPref("thread-fromsize");
      if (fromsize > fontsize) fontsize = fromsize;
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-is", fontsize);
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-is");
    }

    /* Reinstate default hover and select styles */

    if (accountColorsAbout3Pane.prefs.getBoolPref("thread-hoverselect")) {
      element = accountColorsAbout3Pane.threadTree;
      element.setAttribute("ac-hoverselect", "");
    } else {
      element = accountColorsAbout3Pane.threadTree;
      element.removeAttribute("ac-hoverselect");
    }
  },

  messagePane: function (event, clear) {
    // For TB version 103 and above, the message window is handled by about:message (can be accessed via window.messageBrowser.contentWindow)
    if (accountColorsUtilities.thunderbirdVersion.major <= 102 && typeof accountColorsAboutMessage != "undefined") {
      accountColorsAboutMessage.messageWindow(event, clear);
    }
  },
};
