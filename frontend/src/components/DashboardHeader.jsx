function DashboardHeader() {
  return (
    <header>
      <h1>Dashboard</h1>

    {/* << NEW NOTE CONNECTION >> */}
    {/* Frontend calls onNewNote when user clicks New Note */}
    {/* Backend will later create and save the new note */}
    {/* Expected new note structure:
          {
            id: number/string,
            title: string,
            content: string
          }
    */}

      <button>New Note</button>
    </header>
  );
}

export default DashboardHeader;