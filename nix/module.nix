{ self }:

{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.requestTrackerGoogleChat;
  packageForSystem =
    if builtins.hasAttr pkgs.system self.packages
    then self.packages.${pkgs.system}.default
    else throw "requestTrackerGoogleChat: unsupported system ${pkgs.system}; package supports x86_64-linux";
  configuredSecretPaths = filter (path: path != null) [
    cfg.secrets.rtAuthTokenFile
    cfg.secrets.rtWebhookSecretFile
    cfg.secrets.googleChatSpaceWebhookUrlFile
    cfg.secrets.googleApplicationCredentialsFile
    cfg.secrets.adminTokenFile
  ];
  secretChecks = concatMapStringsSep " " escapeShellArg configuredSecretPaths;
in
{
  options.services.requestTrackerGoogleChat = {
    enable = mkEnableOption "Request Tracker Google Chat integration";

    package = mkOption {
      type = types.package;
      default = packageForSystem;
      description = "Package providing the RT Connect service.";
    };

    port = mkOption {
      type = types.port;
      default = 3000;
      description = "TCP port on which RT Connect listens.";
    };

    rtBaseUrl = mkOption {
      type = types.str;
      default = "";
      description = "Base URL of the Request Tracker REST2 instance.";
    };

    googleChatSpaceName = mkOption {
      type = types.str;
      default = "";
      description = "Google Chat API space resource, for example spaces/AAA... .";
    };

    chatAudience = mkOption {
      type = types.str;
      default = "";
      description = "Expected Google Chat bearer-token audience.";
    };

    enableUserDm = mkOption {
      type = types.bool;
      default = false;
      description = "Enable direct messages to ticket requestors when supported by the integration.";
    };

    enableSpaceAlerts = mkOption {
      type = types.bool;
      default = true;
      description = "Deliver newly opened ticket cards to the configured technical staff space.";
    };

    environment = mkOption {
      type = types.enum [ "development" "production" ];
      default = "production";
    };

    stateDirectory = mkOption {
      type = types.str;
      default = "/var/lib/request-tracker-google-chat";
      description = "Directory for mutable JSON state.";
    };

    user = mkOption {
      type = types.str;
      default = "request-tracker-google-chat";
    };

    group = mkOption {
      type = types.str;
      default = "request-tracker-google-chat";
    };

    restartPolicy = mkOption {
      type = types.enum [ "on-failure" "always" "no" ];
      default = "on-failure";
    };

    secrets = {
      rtAuthTokenFile = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Runtime path containing RT_AUTH_TOKEN, typically a sops-nix secret path.";
      };

      rtWebhookSecretFile = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Runtime path containing RT_WEBHOOK_SECRET.";
      };

      googleChatSpaceWebhookUrlFile = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Runtime path containing GOOGLE_CHAT_SPACE_WEBHOOK_URL.";
      };

      googleApplicationCredentialsFile = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Runtime path to Google service-account JSON credentials.";
      };

      adminTokenFile = mkOption {
        type = types.nullOr types.str;
        default = null;
        description = "Runtime path containing RT_CONNECT_ADMIN_TOKEN.";
      };
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.rtBaseUrl != "";
        message = "services.requestTrackerGoogleChat.rtBaseUrl must be set";
      }
      {
        assertion = cfg.environment != "production" || cfg.secrets.rtAuthTokenFile != null;
        message = "Production RT Connect requires secrets.rtAuthTokenFile";
      }
      {
        assertion = cfg.environment != "production" || cfg.secrets.rtWebhookSecretFile != null;
        message = "Production RT Connect requires secrets.rtWebhookSecretFile";
      }
      {
        assertion = cfg.environment != "production" || cfg.secrets.adminTokenFile != null;
        message = "Production RT Connect requires secrets.adminTokenFile";
      }
      {
        assertion = cfg.environment != "production" || cfg.chatAudience != "";
        message = "Production RT Connect requires chatAudience";
      }
      {
        assertion = cfg.environment != "production" || cfg.googleChatSpaceName != "" || cfg.secrets.googleChatSpaceWebhookUrlFile != null;
        message = "Production RT Connect requires googleChatSpaceName or secrets.googleChatSpaceWebhookUrlFile";
      }
      {
        assertion = cfg.googleChatSpaceName == "" || cfg.secrets.googleApplicationCredentialsFile != null;
        message = "googleApplicationCredentialsFile is required when googleChatSpaceName is set";
      }
    ];

    users.groups.${cfg.group} = {};
    users.users.${cfg.user} = {
      isSystemUser = true;
      group = cfg.group;
      home = cfg.stateDirectory;
      createHome = true;
    };

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDirectory} 0750 ${cfg.user} ${cfg.group} - -"
    ];

    systemd.services.request-tracker-google-chat = {
      description = "Request Tracker Google Chat integration";
      wantedBy = [ "multi-user.target" ];
      wants = [ "network-online.target" ];
      after = [ "network-online.target" "sops-nix.service" ];
      path = [ pkgs.coreutils ];
      environment = {
        NODE_ENV = cfg.environment;
        PORT = toString cfg.port;
        RT_BASE_URL = cfg.rtBaseUrl;
        GOOGLE_CHAT_SPACE_NAME = cfg.googleChatSpaceName;
        CHAT_AUDIENCE = cfg.chatAudience;
        RT_CONNECT_DATA_DIR = cfg.stateDirectory;
        RT_ENABLE_USER_DM = boolToString cfg.enableUserDm;
        RT_ENABLE_SPACE_ALERTS = boolToString cfg.enableSpaceAlerts;
      } // optionalAttrs (cfg.secrets.rtAuthTokenFile != null) {
        RT_AUTH_TOKEN_FILE = cfg.secrets.rtAuthTokenFile;
      } // optionalAttrs (cfg.secrets.rtWebhookSecretFile != null) {
        RT_WEBHOOK_SECRET_FILE = cfg.secrets.rtWebhookSecretFile;
      } // optionalAttrs (cfg.secrets.googleChatSpaceWebhookUrlFile != null) {
        GOOGLE_CHAT_SPACE_WEBHOOK_URL_FILE = cfg.secrets.googleChatSpaceWebhookUrlFile;
      } // optionalAttrs (cfg.secrets.adminTokenFile != null) {
        RT_CONNECT_ADMIN_TOKEN_FILE = cfg.secrets.adminTokenFile;
      } // optionalAttrs (cfg.secrets.googleApplicationCredentialsFile != null) {
        GOOGLE_APPLICATION_CREDENTIALS = cfg.secrets.googleApplicationCredentialsFile;
      };
      serviceConfig = {
        ExecStartPre = optional (cfg.environment == "production") ''
          ${pkgs.bash}/bin/bash -ceu 'for secret in ${secretChecks}; do
            test -r "$secret" || { echo "required secret file is missing or unreadable" >&2; exit 1; }
          done'
        '';
        ExecStart = "${cfg.package}/bin/request-tracker-google-chat-integration";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.stateDirectory;
        StateDirectory = baseNameOf cfg.stateDirectory;
        Restart = cfg.restartPolicy;
        RestartSec = 5;
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectHome = true;
        ProtectSystem = "strict";
        ReadWritePaths = [ cfg.stateDirectory ];
        RestrictAddressFamilies = [ "AF_UNIX" "AF_INET" "AF_INET6" ];
        UMask = "0077";
      };
    };
  };
}
