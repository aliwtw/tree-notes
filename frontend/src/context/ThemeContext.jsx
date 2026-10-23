import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";


const ThemeContext =
  createContext(null);


/* =========================================================
   COLOUR VISION OPTIONS
   ========================================================= */

const COLOR_VISION_STORAGE_KEY =
  "treenotes-color-vision";


const VALID_COLOR_VISION_MODES = [
  "standard",
  "deuteranopia",
  "protanopia",
  "tritanopia",
];


export function ThemeProvider({
  children,
}) {

  /* =========================================================
     LIGHT / DARK THEME
     ========================================================= */

  const [theme, setTheme] =
    useState(() => {

      const savedTheme =
        localStorage.getItem(
          "treenotes-theme"
        );


      if (savedTheme) {
        return savedTheme;
      }


      /*
        On first visit, respect the user's
        operating-system preference.
      */

      const prefersDark =
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;


      return prefersDark
        ? "dark"
        : "light";

    });


  /* =========================================================
     COLOUR VISION MODE
     ========================================================= */

  const [
    colorVision,
    setColorVision,
  ] = useState(() => {

    const savedMode =
      localStorage.getItem(
        COLOR_VISION_STORAGE_KEY
      );


    /*
      Only restore recognised modes.

      This prevents an invalid old value
      from being applied to the document.
    */

    if (
      VALID_COLOR_VISION_MODES.includes(
        savedMode
      )
    ) {
      return savedMode;
    }


    return "standard";

  });


  /* =========================================================
     APPLY LIGHT / DARK THEME
     ========================================================= */

  useEffect(() => {

    document.documentElement
      .setAttribute(
        "data-theme",
        theme
      );


    localStorage.setItem(
      "treenotes-theme",
      theme
    );

  }, [theme]);


  /* =========================================================
     APPLY COLOUR VISION MODE
     ========================================================= */

  useEffect(() => {

    document.documentElement
      .setAttribute(
        "data-color-vision",
        colorVision
      );


    localStorage.setItem(
      COLOR_VISION_STORAGE_KEY,
      colorVision
    );

  }, [colorVision]);


  /* =========================================================
     THEME TOGGLE
     ========================================================= */

  function toggleTheme() {

    setTheme((current) =>
      current === "dark"
        ? "light"
        : "dark"
    );

  }


  /* =========================================================
     CONTEXT PROVIDER
     ========================================================= */

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,

        colorVision,
        setColorVision,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}


export function useTheme() {

  const context =
    useContext(ThemeContext);


  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider."
    );
  }


  return context;
}