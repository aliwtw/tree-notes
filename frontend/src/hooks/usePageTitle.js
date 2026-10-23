import { useEffect } from "react";


export default function usePageTitle(title) {

  useEffect(() => {

    if (!title) {
      document.title = "TreeNotes";
      return;
    }


    document.title =
      title === "TreeNotes"
        ? "TreeNotes"
        : `${title} - TreeNotes`;

  }, [title]);

}