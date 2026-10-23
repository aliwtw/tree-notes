import { useState } from "react";
import { ArrowUp } from "lucide-react";


function SearchBar({
  placeholder = "Semantic search...",
  ariaLabel = "Semantic search",
  onSearch,
  loading = false,
}) {
  const [searchTerm, setSearchTerm] = useState("");


  async function handleSubmit(event) {
    event.preventDefault();

    const query = searchTerm.trim();

    if (!query || loading) {
      return;
    }

    await onSearch(query);
  }


  return (
    <form
      className="search-bar"
      onSubmit={handleSubmit}
      role="search"
      aria-label={ariaLabel}
    >
      <input
        type="text"
        value={searchTerm}
        onChange={(event) =>
          setSearchTerm(event.target.value)
        }
        placeholder={placeholder}
        aria-label={ariaLabel}
      />


      <button
        className="search-submit-button tooltip-align-right"
        type="submit"
        disabled={loading || !searchTerm.trim()}
        data-tooltip="Semantic search"
        aria-label="Semantic search"
      >
        <ArrowUp
          size={18}
          strokeWidth={2}
        />
      </button>
    </form>
  );
}


export default SearchBar;