/** Mock expo-router — zapisuje nawigacje zamiast nawigować. */
export const pushed: string[] = [];
export const router = {
  push: (path: string) => {
    pushed.push(path);
  },
  back: () => {},
  replace: (path: string) => {
    pushed.push(path);
  },
};
export const __resetRouter = () => {
  pushed.length = 0;
};
