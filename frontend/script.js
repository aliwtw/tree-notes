// --------------------------------------------------------------------------
// DOM Element and Data Initialization
// --------------------------------------------------------------------------

// Map to store box elements, with their ID as keys and an object
// containing the box element and a Map of connected lines as values.
let boxes = new Map();

// Array, currently not used for any specific functionality.
let bin = [];

// Counter for the total number of boxes created. Used to assign unique IDs.
let totalBoxes = 1;

// Get the first DOM element with the class "box". This is likely the initial box.
const seed = document.querySelectorAll(".box")[0];

// --------------------------------------------------------------------------
// Event Listeners Attached on Initialization
// --------------------------------------------------------------------------

// Attach a listener to the seed box to handle pasting images directly into it.
listenForImagePaste(seed);

// Make the initial seed box draggable using the makeDraggable function.
makeDraggable(seed);

// Attach event listeners to the buttons within the box toolbar.
boxToolbarListeners();

// --------------------------------------------------------------------------
// Initialization of the 'boxes' Map with the Seed Box
// --------------------------------------------------------------------------

// Add the seed box to the 'boxes' Map. The key is the box's ID,
// and the value is an object containing the box element itself and an empty
// Map to store the IDs of the lines connected to this box.
boxes.set(seed.id, {
    box: seed,
    lines: []
});

// --------------------------------------------------------------------------
// Zoom Functionality
// --------------------------------------------------------------------------

/**
 * Zooms the canvas in or out by multiplying the current scale.
 * @param {number} times - The factor by which to zoom (e.g., 2 for 2x zoom, 0.5 for 0.5x zoom).
 */
function zoom(times) {
    const canvas = document.getElementById("zoom");
    const scale = (new DOMMatrix(canvas.style.transform)).a;
    canvas.style.transform = `scale(${scale * times})`;
}

// --------------------------------------------------------------------------
// Drag and Drop Functionality for Boxes
// --------------------------------------------------------------------------

/**
 * Makes a given HTML element draggable.
 * Uses closures to maintain event listener variables without global scope.
 * @param {HTMLElement} box - The HTML element to make draggable.
 */
function makeDraggable(box) {
    let isDragging = false;
    let offsetX, offsetY;

    // Event listener for when the box loses focus (blur event).
    // Resets the box height and updates connected lines.
    box.addEventListener("blur", () => {
        box.style.height = "7px";
        updateLinesPosition(box);
    });

    // Event listener for when the box is clicked.
    // Shows the toolbar associated with the clicked box.
    box.addEventListener("click", () => {
        box.style.height = "fit-content";
        const toolbar = document.getElementById('toolbar');
        const rect = box.getBoundingClientRect();
        toolbar.style.left = rect.right + 'px';
        toolbar.style.top = rect.top + 'px';
        const colorPicker = document.getElementById("boxColor");
        colorPicker.value = colorToHex(box.style.backgroundColor);
        toolbar.style.display = 'block';
        document.getElementById("toolbar").dataset.boxId = box.id;
    });

    // Event listener for when the mouse button is pressed down on the box.
    // Initiates the dragging process.
    box.addEventListener("mousedown", (e) => {
        isDragging = true;
        offsetX = e.clientX - box.offsetLeft;
        offsetY = e.clientY - box.offsetTop;
        box.style.cursor = "grabbing";
    });

    // Event listener for mouse movement across the window.
    // Handles the actual dragging of the box and updates line positions.
    window.addEventListener("mousemove", (e) => {
        const container = document.getElementById("tree");
        const limitReached = container.offsetLeft > e.clientX || container.offsetTop > e.clientY;
        if (!isDragging || limitReached) return;
        box.style.left = e.clientX - offsetX + "px";
        box.style.top = e.clientY - offsetY + "px";
        updateLinesPosition(box);
    });

    // Event listener for when the mouse button is released over the window.
    // Ends the dragging process.
    window.addEventListener("mouseup", () => {
        isDragging = false;
        box.style.cursor = "grab";
    });
}

// --------------------------------------------------------------------------
// Box Creation and Management
// --------------------------------------------------------------------------

/**
 * Adds a new block adjacent to the currently selected box and connects them with a line.
 * @param {HTMLElement} box - The reference box to which the new block will be connected.
 */
function addBlock(box) {
    [x1, y1] = getBoxCoords(box);
    const newBox = createNewBlock(x1, y1);
    newLine(box, newBox);
}

/**
 * Creates a new draggable block (div element) and appends it to the "boxes" container.
 * @param {number} [x=0] - The initial x-coordinate (left position) of the new box.
 * @param {number} [y=20] - The initial y-coordinate (top position) of the new box.
 * @param {string} [content="New Box"] - The initial text content of the new box.
 * @returns {HTMLElement} The newly created box element.
 */
function createNewBlock(x = 0, y = 20, content = "New Box") {
    let newBox = document.createElement('div');
    totalBoxes += 1;
    newBox.id = totalBoxes;
    newBox.className = "box";
    newBox.style.position = "absolute";
    newBox.style.left = `${x}px`;
    newBox.style.top = `${y}px`;
    newBox.textContent = content;
    newBox.contentEditable = true;
    newBox.style.backgroundColor = "#f1f1f1";
    const footer = document.createElement("h6");
    footer.innerHTML = `#${totalBoxes}`;
    footer.className = "boxFooter";
    newBox.appendChild(footer);
    document.getElementById("boxes").appendChild(newBox);
    makeDraggable(newBox);
    listenForImagePaste(newBox);
    boxes.set(newBox.id, {
        box: newBox,
        lines: []
    });
    return newBox;
}

// --------------------------------------------------------------------------
// Placeholder Text Functionality
// --------------------------------------------------------------------------
const headingText = document.getElementById("heading");
const defaultText = document.getElementById("text");
const notesField = document.getElementById("notes");

inputField.addEventListener("input", function() {
    if (headingText.value !== "") {
        headingText.style.display = "none";
    } else {
        headingText.style.display = "block";
    }
    if (defaultText.value !== "") {
        defaultText.style.display = "none";
    } else {
        defaultText.style.display = "block";
    }
    if (notesField.value !== "") {
        notesField.style.display = "none";
    } else {
        notesField.style.display = "block";
    }
});

/**
 * Deletes a specified box and all the lines connected to it.
 * @param {HTMLElement} box - The box element to be deleted.
 */
function deleteBox(box) {
    const lines = getLinesAttached(box);
    lines.forEach(line => {
        deleteLine(line);
    });
    box.remove();
    boxes.delete(box.id);
}

// --------------------------------------------------------------------------
// Line Creation and Management
// --------------------------------------------------------------------------

/**
 * Creates a new SVG line element connecting two specified boxes.
 * @param {HTMLElement|string} box1 - The first box element or its ID.
 * @param {HTMLElement|string} box2 - The second box element or its ID.
 */
function newLine(box1, box2) {
    //console.log(box1);
    if (!box1?.id) box1 = document.getElementById(box1);
    if (!box2?.id) box2 = document.getElementById(box2);
    const newLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    let id = "";
    if (+box1.id < +box2.id) {
        id = box1.id + "_" + box2.id;
    } else {
        id = box2.id + "_" + box1.id;
    }
    newLine.setAttribute('id', id);

    // Add box ids to line lists
    
    const box1Lines = boxes.get(box1.id).lines;
    if (!box1Lines.includes(box2.id)) box1Lines.push(box2.id);

    const box2Lines = boxes.get(box2.id).lines;
    if (!box2Lines.includes(box1.id)) box2Lines.push(box1.id);


    newLine.setAttribute('class', 'line');
    [x1, y1] = getBoxCoords(box1);
    [x2, y2] = getBoxCoords(box2);
    updateLinePosition(newLine, x1, y1, x2, y2);
    document.getElementById("lines").appendChild(newLine);
}

/**
 * Updates the position of all lines connected to a given box.
 * @param {HTMLElement} box - The box whose connected lines need to be updated.
 */
function updateLinesPosition(box) {
    const lines = document.querySelectorAll(".line");
    lines.forEach((line) => {
        let boxes = (line.id).split('_');
        if (box.id == boxes[0]) {
            [x1, y1] = getBoxCoords(box);
            updateLinePosition(line, x1, y1, false, false);
        } else if (box.id == boxes[1]) {
            [x2, y2] = getBoxCoords(box);
            updateLinePosition(line, false, false, x2, y2);
        }
    });
}

/**
 * Deletes a specified SVG line element and updates the 'boxes' Map accordingly.
 * @param {SVGLineElement} line - The SVG line element to be deleted.
 */
function deleteLine(line) {
    const [a, b] = line.id.split("_");
    boxes.values().forEach(item => {
        item.lines = item.lines.filter(id => id!==a && id!==b)
    });
    line.remove();
}

/**
 * Retrieves all SVG line elements that are connected to a given box.
 * @param {HTMLElement} box - The box element to find connected lines for.
 * @returns {SVGLineElement[]} An array of SVG line elements connected to the box.
 */
function getLinesAttached(box) {
    let lines = document.querySelectorAll(".line");
    lines = Array(...lines).filter(line => {
        const [a, b] = line.id.split("_");
        if (a == box.id) {
            return true;
        } else if (b == box.id) {
            return true;
        }
        return false;
    });
    return lines;
}

/**
 * Gets the center coordinates (x, y) of a given HTML element.
 * @param {HTMLElement} box - The HTML element.
 * @returns {number[]} An array containing the x and y coordinates of the center of the box.
 */
function getBoxCoords(box) {
    const x = box.offsetLeft + box.offsetWidth / 2;
    const y = box.offsetTop + box.offsetHeight / 2;
    return [x, y];
}

/**
 * Updates the coordinates of an SVG line element.
 * @param {SVGLineElement} line - The SVG line element to update.
 * @param {number|boolean} [x1=false] - The new x1 coordinate, or false to not update.
 * @param {number|boolean} [y1=false] - The new y1 coordinate, or false to not update.
 * @param {number|boolean} [x2=false] - The new x2 coordinate, or false to not update.
 * @param {number|boolean} [y2=false] - The new y2 coordinate, or false to not update.
 */
function updateLinePosition(line, x1 = false, y1 = false, x2 = false, y2 = false) {
    if (x1) line.setAttribute("x1", x1);
    if (y1) line.setAttribute("y1", y1);
    if (x2) line.setAttribute("x2", x2);
    if (y2) line.setAttribute("y2", y2);
}

// --------------------------------------------------------------------------
// Image Pasting Functionality
// --------------------------------------------------------------------------

/**
 * Attaches an event listener to a given HTML element to handle image pasting.
 * When an image is pasted, it creates an <img> tag and appends it to the element.
 * @param {HTMLElement} box - The HTML element to which the paste listener will be attached.
 */
function listenForImagePaste(box) {
    box.addEventListener('paste', function (event) {
        let items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf("image") === 0) {
                event.preventDefault();
                let blob = item.getAsFile();
                let reader = new FileReader();
                reader.onload = function (event) {
                    let img = document.createElement("img");
                    img.src = event.target.result;
                    img.style.maxWidth = "100%";
                    box.appendChild(img);
                };
                reader.readAsDataURL(blob);
            }
        }
    });
}

// --------------------------------------------------------------------------
// Custom Text Context Menu and Highlighting
// --------------------------------------------------------------------------

/**
 * Checks if the current text selection is within a <span> element inside the "#text" container.
 * @param {Selection} selection - The current window text selection.
 * @returns {HTMLElement|boolean} The <span> element if selected text is within one, otherwise false.
 */
function isSpan(selection) {
    const range = selection.getRangeAt(0);
    let commonAncestor = range.commonAncestorContainer;
    if (commonAncestor.nodeType === Node.TEXT_NODE) {
        commonAncestor = commonAncestor.parentElement;
    }
    if (!commonAncestor.closest('#text')) return false;
    if (commonAncestor.tagName === "SPAN") {
        return commonAncestor;
    }
    return false;
}

/**
 * Highlights the selected text by wrapping it in a span with the given background color.
 * If the selected text is already within a span, it updates the background color.
 * @param {string} color - The background color to apply to the highlighted text.
 * @param {HTMLElement|boolean} isSpan - The existing span element if the text is already highlighted, or false otherwise.
 * @returns {HTMLElement|boolean} The created or updated span element, or false if an error occurred.
 */
function highlightText(color, isSpan) {
    if (isSpan) {
        isSpan.style.backgroundColor = color;
        addGlow(isSpan, color);
    } else {
        const span = document.createElement("span");
        span.className = "highlight";
        span.style.backgroundColor = color;
        try {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            range.surroundContents(span);
            addGlow(span, color);
            return span;
        } catch (error) {
            console.warn("Erros Highlighting", error);
            return false;
        }
    }
}

/**
 * Removes a span element, effectively removing the highlight or link.
 * @param {HTMLElement} span - The span element to remove.
 */
function removeSpan(span) {
    const content = span.textContent;
    const textNode = document.createTextNode(content);
    span.replaceWith(textNode);
}

/**
 * Updates the options in the link dropdown within the text toolbar.
 * @param {string} link - The ID of the box that should be marked as selected, if any.
 */
function updateBoxList(link) {
    const dropdown = document.getElementById("t_dropdown");
    const boxes = document.getElementById("boxes").children;
    dropdown.innerHTML = `<option value='none' ${link ? "" : "selected"}>--None--</option>`;
    Array(...boxes).forEach(box => {
        const option = document.createElement("option");
        option.value = box.id;
        option.selected = link == box.id ? "selected" : "";
        option.innerHTML = "Box# " + box.id;
        dropdown.appendChild(option);

        // Add glow effect on mouseenter/mouseleave for dropdown options
        option.addEventListener("mouseenter", e => glowBox(e));
        option.addEventListener("mouseleave", e => noGlowBox(e));

        function glowBox(e) {
            const id = e.target.value;
            document.documentElement.style.setProperty("--glow-color", "black");
            document.getElementById(id)?.classList.add("glow");
        }

        function noGlowBox(e) {
            const id = e.target.value;
            document.getElementById(id)?.classList.remove("glow");
        }
    });
}

/**
 * Extracts the box ID from a string that represents setting the window location hash.
 * @param {string} e - The string containing the window.location.href assignment.
 * @returns {string|boolean} The extracted box ID, or false if no ID is found.
 */
function getLink(e) {
    let match = e.match(/window\.location\.href\s*=\s*['"]#(.*?)['"]/);
    if (match) {
        match = match[1];
        console.log("ID:", match);
        return match;
    }
    return false;
}

/**
 * Event listener for the "text" element's context menu (right-click).
 * Prevents the default context menu and displays a custom text toolbar.
 */
document.getElementById("text").addEventListener("contextmenu", (e) => {
    e.preventDefault();

    // To remove all event listeners on the toolbar (for updating them)
    const loadToolbar = document.getElementById("textToolbar");
    loadToolbar.parentNode.replaceChild(loadToolbar.cloneNode(true), loadToolbar);

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    let span = isSpan(selection);

    // Event listener for the text highlight color picker
    document.getElementById("t_boxColor").addEventListener("change", e => {
        const color = colorToHex(e.target.value);
        highlightText(color, span);
    });

    // Event listener for the link dropdown
    document.getElementById("t_dropdown").addEventListener("change", e => {
        if (!span) {
            span = highlightText("#FFFF00", false);
            document.getElementById("t_boxColor").value = "#FFFF00";
        }
        span.dataset.boxId = e.target.value;
        span.setAttribute("onclick", `window.location.href='#${e.target.value}'`);
    });

    // Event listener for removing the text highlight/link
    document.getElementById("t_remove").addEventListener("click", e => {
        if (span) {
            removeSpan(span);
            removetoolbar();
        }
    });

    // Update the color picker value and visibility of the remove button
    document.getElementById("t_boxColor").value = span ? colorToHex(span.style.backgroundColor) : "#ffffff";
    document.getElementById("t_remove").style.display = span ? "inline" : "none";
    updateBoxList(span.dataset?.boxId);

    const toolbar = document.getElementById("textToolbar");
    toolbar.style.left = e.clientX + 'px';
    toolbar.style.top = e.clientY + 'px';

    toolbar.style.display = 'block'; // Show the toolbar

    // Function to hide the text toolbar and clear selection
    function removetoolbar() {
        selection?.removeAllRanges();
        toolbar.style.display = 'none';
    }
});

// --------------------------------------------------------------------------
// Toolbar Visibility Management (General)
// --------------------------------------------------------------------------

/**
 * Event listener for clicks anywhere on the document to hide the toolbars.
 */
document.addEventListener('click', function (event) {
    const toolbar = document.getElementById('toolbar');
    const textToolbar = document.getElementById("textToolbar");

    // Hide the box toolbar if the click is outside the "boxes" container
    if (!event.target.closest('#boxes')) {
        toolbar.style.display = 'none';
    }

    // Hide the text toolbar if the click is outside the "textToolbar"
    if (!event.target.closest("#textToolbar")) {
        textToolbar.style.display = 'none';
    }
});

// --------------------------------------------------------------------------
// Box Toolbar Event Listeners
// --------------------------------------------------------------------------

/**
 * Attaches event listeners to the buttons within the box toolbar.
 */
function boxToolbarListeners() {
    // Event listener for the box color picker
    document.getElementById("boxColor").addEventListener("change", (e) => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        box.style.backgroundColor = colorToHex(e.target.value);
    });

    // Event listener for the "addBox" button
    document.getElementById("addBox").addEventListener("click", e => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        addBlock(box);
    });

    // Event listener for the "deleteBox" button
    document.getElementById("deleteBox").addEventListener("click", e => {
        const box = document.getElementById(e.target.parentNode.dataset.boxId);
        deleteBox(box);
    });
}

// --------------------------------------------------------------------------
// Text Highlighting and Link Styling
// --------------------------------------------------------------------------

/**
 * Adds mouseenter and mouseleave event listeners to a span element to apply a glow effect
 * to the associated box.
 * @param {HTMLElement} span - The span element that triggers the glow.
 * @param {string} color - The color of the glow effect.
 */
function addGlow(span, color) {
    span.addEventListener("mouseenter", e => glowBox(e));
    span.addEventListener("mouseleave", e => noGlowBox(e));

    function glowBox(e) {
        const id = e.target.dataset?.boxId;
        document.documentElement.style.setProperty("--glow-color", color);
        document.getElementById(id)?.classList.add("glow");
    }

    function noGlowBox(e) {
        const id = e.target.dataset?.boxId;
        document.getElementById(id)?.classList.remove("glow");
    }
}

// --------------------------------------------------------------------------
// Dropdown Menu for Connecting Boxes
// --------------------------------------------------------------------------

// Toggle the dropdown visibility when the button is hovered over
document.querySelector(".dropdown-button").addEventListener('mouseover', e => {
    const container = document.querySelector(".dropdown-content");
    container.innerHTML = "";
    const boxId = container.parentNode.parentNode.dataset.boxId;
    const allIds = boxes.keys();
    const conectedIds = [...boxes.get(boxId).lines];


    conectedIds.sort((a, b) => a - b);

    allIds.forEach(l => {
        let element = document.createElement("div");
        element.className = "dropdown-item";

        // on click add/remove line
        element.addEventListener("click", (e) => {
            const a = e.target.dataset.a;
            const b = e.target.dataset.b;
            const c = e.target.dataset.c;

            if (+c) {
                deleteLine(document.getElementById(a + "_" + b));
            } else {
                newLine(a, b);
            }
        });

        if (l == boxId) return;
        element.innerHTML = "Box# " + l;

        if (+boxId < +l) {
            // Add lines connecting box ids
            element.dataset.a = boxId;
            element.dataset.b = l;
        } else {
            // Add lines connecting box ids
            element.dataset.a = l;
            element.dataset.b = boxId;
        }

        // set connection status
        element.dataset.c = 0;

        conectedIds.forEach(e => {
            if (l == e) {
                element.innerHTML += " ✅";
                conectedIds.shift();
                // set connection status
                element.dataset.c = 1;
            }
        });
        container.appendChild(element);
    });
    e.target.parentNode.classList.add("show");
});

document.querySelector("#link").addEventListener('mouseleave', e => {
    e.target.classList.remove("show");
});

// --------------------------------------------------------------------------
// Color Conversion Functions
// --------------------------------------------------------------------------

/**
 * Converts a color string (hex, rgb, or hsl) to its hexadecimal representation.
 * Returns '#f1f1f1' for invalid color formats.
 * @param {string} color - The color string to convert.
 * @returns {string} The hexadecimal representation of the color.
 */
function colorToHex(color) {
    if (color.startsWith("#")) {
        return color;
    }
    if (color.startsWith("rgb")) {
        let rgb = color.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
        if (rgb) {
            return rgbToHex(parseInt(rgb[1]), parseInt(rgb[2]), parseInt(rgb[3]));
        }
    }
    if (color.startsWith("hsl")) {
        let hsl = color.match(/hsl\(\s*(\d+),\s*(\d+)%,\s*(\d+)%\s*\)/);
        if (hsl) {
            return hslToHex(parseInt(hsl[1]), parseInt(hsl[2]), parseInt(hsl[3]));
        }
    }
    console.warn("Invalid Color ", color);
    return "#f1f1f1";
}

/**
 * Converts RGB color values to a hexadecimal color string.
 * @param {number} r - The red color value (0-255).
 * @param {number} g - The green color value (0-255).
 * @param {number} b - The blue color value (0-255).
 * @returns {string} The hexadecimal representation of the RGB color.
 */
function rgbToHex(r, g, b) {
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Converts HSL color values to a hexadecimal color string.
 * @param {number} h - The hue value (0-360).
 * @param {number} s - The saturation value (0-100).
 * @param {number} l - The lightness value (0-100).
 * @returns {string} The hexadecimal representation of the HSL color.
 */
function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r, g, b;
    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase()}`;
}