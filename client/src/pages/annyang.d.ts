declare module 'annyang' {
    interface Annyang {
      addCommands: (commands: { [command: string]: () => void }) => void;
      start: (options?: { autoRestart?: boolean; continuous?: boolean }) => void;
      abort: () => void;
      addCallback: (
        event: string,
        callback: (userSaid?: string[], commandText?: string, results?: string[]) => void
      ) => void;
      removeCallback: (
        event: string,
        callback?: (userSaid?: string[], commandText?: string, results?: string[]) => void
      ) => void;
    }
  
    const annyang: Annyang;
    export default annyang;
  }