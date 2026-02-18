/**
 * IRC channel plugin types.
 */

export type IrcNickServConfig = {
  service?: string;
  password?: string;
  passwordFile?: string;
  registerEmail?: string;
};

export type IrcAccountConfig = {
  enabled?: boolean;
  name?: string;
  host?: string;
  port?: number;
  tls?: boolean;
  nick?: string;
  username?: string;
  realname?: string;
  password?: string;
  passwordFile?: string;
  channels?: string[];
  nickserv?: IrcNickServConfig;
  dmPolicy?: string;
  groupPolicy?: string;
  allowFrom?: Array<string | number>;
  groupAllowFrom?: Array<string | number>;
};

export type CoreConfig = {
  channels?: {
    irc?: IrcAccountConfig & {
      accounts?: Record<string, IrcAccountConfig>;
    };
    defaults?: {
      groupPolicy?: string;
    };
  };
};
