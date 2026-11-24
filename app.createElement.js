const e = React.createElement;

const App = (props) => {
  const [items, setItems] = React.useState([]);
  const [draft, setDraft] = React.useState("");
  console.log("render", items);
  const remove = (id) => setItems((prev) => prev.filter((x) => x.id !== id));
  const listItems = items.map((row) =>
    e(
      "li",
      { key: row.id },
      row.text,
      e("button", { onClick: () => remove(row.id) }, "x"),
    ),
  );
  console.log("listItems: ", listItems);
  return e(
    "div",
    null,
    e(
      "button",
      {
        onClick: () => {
          if (!draft.trim()) return;
          setItems((prev) => [
            ...prev,
            { id: crypto.randomUUID(), text: draft },
          ]);
          setDraft("");
        },
      },
      "Add",
    ),
    e("input", {
      value: draft,
      onChange: (event) => setDraft(event.target.value),
    }),
    e("ul", null, listItems),
  );
};
ReactDOM.createRoot(document.getElementById("root")).render(
  e(React.StrictMode, null, e(App)),
);
