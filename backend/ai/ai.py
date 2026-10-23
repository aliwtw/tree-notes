from typing import cast

import requests, json, subprocess, os
from .models import SummaryResponse, ConceptGraphResponse, SearchGraphResult
from ..schemas import SemanticSearchRequest

OLLAMA_URL = os.getenv("OLLAMA_URL")
SMALL_MODEL = os.getenv("SMALL_MODEL_NAME")
LARGE_MODEL = os.getenv("LARGE_MODEL_NAME")
EXPLICIT_MODEL = os.getenv("OLLAMA_MODEL")

ACTIVE_MODEL = SMALL_MODEL

# Number of model layers Ollama should offload to GPU.
# Default to CPU-only for stability on machines where GPU inference crashes.
OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU", "0"))

### Simple Prompts for use in Frontend Testing

(
    # Roses grow best in sunny gardens. Bees are attracted to their bright colors and sweet fragrance. When bees visit roses, they help pollinate the flowers, allowing new blooms to form. Without enough sunlight or pollination, roses struggle to grow strong and healthy.
    # Cacti store water in their thick stems to survive in hot deserts. Their spines protect them from animals and help reduce water loss. When rainfall occurs, cacti absorb moisture quickly, allowing them to grow new stems. Without enough sunlight, cacti become weak and struggle to thrive.
    # Volcanoes erupt when pressure builds beneath the Earth’s crust. Lava flows from the crater, destroying plants and reshaping the landscape. Ash clouds rise into the sky, affecting air quality and blocking sunlight. After an eruption, minerals in the lava help enrich the soil, allowing new plants to grow.

    # Spiders (order Araneae) are air-breathing arthropods that have eight limbs, chelicerae with fangs generally able to inject venom, and spinnerets that extrude silk. They are the largest order of arachnids and rank seventh in total species diversity among all orders of organisms. Spiders are found worldwide on every continent except Antarctica, and have become established in nearly every land habitat. As of January 2026, 53,680 spider species in 139 families have been recorded by taxonomists. However, there has been debate among scientists about how families should be classified, with over 20 different classifications proposed since 1900. Anatomically, spiders (as with all arachnids) differ from other arthropods in that the usual body segments are fused into two tagmata, the cephalothorax or prosoma, and the opisthosoma, or abdomen, and joined by a small, cylindrical pedicel. However, as there is currently neither paleontological nor embryological evidence that spiders ever had a separate thorax-like division, there exists an argument against the validity of the term cephalothorax, which means fused cephalon (head) and the thorax. Similarly, arguments can be formed against the use of the term "abdomen", as the opisthosoma of all spiders contains a heart and respiratory organs, organs atypical of an abdomen. Unlike insects, spiders do not have antennae. In all except the most primitive group, the Mesothelae, spiders have the most centralized nervous systems of all arthropods, as all their ganglia are fused into one mass in the cephalothorax. Unlike most arthropods, spiders have no extensor muscles in their limbs and instead extend them by hydraulic pressure. Their abdomens bear appendages, modified into spinnerets that extrude silk from up to six types of glands. Spider webs vary widely in size, shape and the amount of sticky thread used. It now appears that the spiral orb web may be one of the earliest forms, and spiders that produce tangled cobwebs are more abundant and diverse than orb-weaver spiders. Spider-like arachnids with silk-producing spigots (Uraraneida) appeared in the Devonian period, about 386 million years ago, but these animals apparently lacked spinnerets. True spiders have been found in Carboniferous rocks from 318 to 299 million years ago and are very similar to the most primitive surviving suborder, the Mesothelae. The main groups of modern spiders, Mygalomorphae and Araneomorphae, first appeared in the Triassic period, more than 200 million years ago. The species Bagheera kiplingi was described as herbivorous in 2008, but all other known species are predators, mostly preying on insects and other spiders, although a few large species also take birds and lizards. An estimated 25 million tons of spiders kill 400–800 million tons of prey every year. Spiders use numerous strategies to capture prey: trapping it in sticky webs, lassoing it with sticky bolas, mimicking the prey to avoid detection, or running it down. Most detect prey mainly by sensing vibrations, but the active hunters have acute vision and hunters of the genus Portia show signs of intelligence in their choice of tactics and ability to develop new ones.
)

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### WARM UP OLLAMA ---> PRELOAD

def detect_vram_gb():
    try:
        output = subprocess.check_output(
            ["docker", "exec", "ollama", "nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"]
        )
        return int(output.decode().strip()) // 1024
    except Exception:
        return 0

def warm_ollama():
    global ACTIVE_MODEL

    if EXPLICIT_MODEL:
        ACTIVE_MODEL = EXPLICIT_MODEL
    else:
        if detect_vram_gb() >= 12:
            ACTIVE_MODEL = LARGE_MODEL

    resp = requests.post(OLLAMA_URL, json={
        "model": ACTIVE_MODEL,
        "prompt": "Warm-up prompt",
        "stream": False,
        "options": { "num_gpu": OLLAMA_NUM_GPU }
    })
    _ = resp.json() # forces Ollama to load fully

    return

### Prompt Templates ~~~~~~~~~~~~~~~

concept_extraction_template = """
You are an AI that extracts concepts and relationships from text.

Return ONLY valid JSON matching this EXACT schema:

```json
{"concepts": [{"concept_id": int,"concept_name": str,"importance": float,"relationships": [{"target_id": int,"relationship": str,"weight": float}]}]}
```

Concept Importance is a type of score and must reflect:
- centrality in the text
- number and strength of relationships
- causal significance
- semantic relevance

Relationship Weight is a type of score and must reflect:
- strength of the relationships as express in the text
- clarity of causation or dependency
- contextual certainty
- narrative importance

Rules:
- concept_id must be sequential integers starting at 1
- concept_name must be derived verbatim from the text and the shortest possible noun phrase in snake_case
- relationships must reference valid concept_ids
- relationships cannot be the same or similar to any concept_name
- relationship phrases must be compressed into concise action verbs in snake_case. Examples:
-- "flows from the crater" -> "flow_from_crater"
-- "affecting air quality" -> "affect_air_quality"
-- "protect from animals with spines" -> "protects_from_animals"
- importance and weight must be floats between 0 and 1
- importance and weight must reflect the strength of the four listed properties, normalised between 0 and 1
- use the full range of 0 to 1 for importance and weight
- high scores (0.7-1) should only be used for very strong, explicit relationships
- moderate scores (0.4-0.6) should be used for typical relationships
- low scores (0.0-0.3) should be used for weak or implied relationships
- do NOT include explanations or commentary
- output ONLY in the JSON format as given

Example of correct concept extraction:
Text: "Bees collect nectar from flowers. Nectar helps bees produce honey. Flowers rely on bees for pollination."
JSON:
{"concepts": [{"concept_id": 1,"concept_name": "bees","importance": 0.8,"relationships": [{"target_id": 2,"relationships": "collect_nectar","weight": 0.6},{"target_id": 3,"relationships": "produce_honey","weight": 0.5},]},{"concept_id": 2,"concept_name": "flowers","importance": 0.7,"relationships": [{"target_id": 1,"relationships": "provide_nectar","weight": 0.6},{"target_id": 3,"relationships": "enable_pollination","weight": 0.7},]},{"concept_id": 3,"concept_name": "nectar","importance": 0.6,"relationships": [{"target_id": 1,"relationships": "used_for_honey","weight": 0.5}]}]}

Your Text to analyse:
"""

summary_generation_templates = {
    "provide_summary": """
You are an expert summarisation assistant. Your task is to produce a clear, concise, and accurate summary based strictly on the information provided.

You will be given:
1. Raw Notes - the ground-truth source of information. This may be unstructured, incomplete, or poorly formatted.
2. Optional Graph Data - a JSON representation of concepts and relationships extracted from the Raw Notes. If provided, you may use it only to reinforce or clarify information already present in the Raw Notes.

Rules:
- Base your summary primarily on the Raw Notes.
- You may use Graph Data only when it supports or clarifies information already present in the Raw Notes.
- Do NOT invent new information or make assumptions beyond what is explicitly stated in the sources.
- Do NOT include headings or lists. Write in plain paragraph form.
- Your output must be concise and factual.
- Your output must be a valid JSON matching this exact schema:

```json
{"aiSummary": "<string>"}
```

Return ONLY the JSON object. Do NOT return any commentary, markdown fences, or explanations.

Your sources:
""",
    "provide_user_summary": """
You are an expert writing reviewer. Your task is to evaluate a user's summary based strictly on the information provided.

You will be given:
1. Raw Notes — the ground‑truth source of information. This may be unstructured, incomplete, or poorly formatted.
2. User Summary — the summary written by the user.

Your job:
- Identify whether the user's summary accurately reflects the Raw Notes.
- Point out any factual mistakes, omissions, or unsupported claims.
- Provide constructive, supportive feedback.
- Assign a score between 0 and 100 based on accuracy, clarity, and completeness.

Rules:
- Base your evaluation primarily on the Raw Notes.
- You may use Graph Data only when it supports or clarifies information already present in the Raw Notes.
- Do NOT invent new information or make assumptions beyond what is explicitly stated.
- Your feedback must be concise, supportive, and constructive.
- Your output must be valid JSON matching this exact schema:

```json
{"userSummaryReview": "<string>", "userScore": <integer>}
```

Return ONLY the JSON object. Do NOT return any commentary, markdown fences, or explanations.

Your sources:
"""
}

graph_searching_template = """
You are searching for a node in a JSON representation of a graph. You are provided with a query with which you must use to locate the node.

The query can have spelling mistakes, be multiple words or a phrase, or be a single word or numbers.

You will receive in a single JSON structure which contains both the query ("query") and the graph ("graph").

You must semantically understand the query and provide the most likely node associated with that query.

Rules:
- You MUST ONLY choose from the nodes provided in the graph nodes.
- You MUST NOT invent node_ids or labels
- You MUST NOT paraphrase labels. Use the label EXACTLY as it appears in the graph.
- You MUST NOT include explanations, reasoning, or commentary in your output.
- You MUST output ONLY valid JSON.
- You MUST NOT include trailing commas.
- node_id MUST be an integer.
- label MUST be a string.

Scoring:
- You MUST output a SEMANTIC SIMILARITY SCORE ("score")
- score MUST be a float between 0.00 and 1.00 and MUST include a leading zero(e.g., 0.92).
- 0.00 = no similarity.
- 1.00 = identical similarity.

Your output MUST be a valid JSON matching this exact schema:

```json
{"node_id": <integer>, "label": "<string>", "score": <float>}
```

If no node is semantically correlated with the query, return EXACTLY:
{"node_id": -1, "label": "", "score": -1.0}

Here are two examples:

1)
Input:
{ "query": "javascript", "graph": {"nodes": [{"id": "1", "label": "React"}, {"id": "2", "label": "JavaScript"}, {"id": "3", "label": "Components"}], "edges": [{"id": "e1", "source": "1", "target": "2"}, {"id": "e2", "source": "1", "target": "3"}]} }

Your response as output:
{"node_id": 2, "label": "JavaScript", "score": 1.00}

2)
Input:
{ "query": "potatoes", "graph": {"nodes": [{"id": "1", "label": "React"}, {"id": "2", "label": "JavaScript"}, {"id": "3", "label": "Components"}], "edges": [{"id": "e1", "source": "1", "target": "2"}, {"id": "e2", "source": "1", "target": "3"}]} }

Your response as output:
{"node_id": -1, "label": "", "score": -1.00}

Your JSON to analyse:
"""

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## HELPER FUNCTIONS ~~~~~~~~~~~~~~~~

def create_payload(prompt, stream=False):
    return { "model": ACTIVE_MODEL, "prompt": prompt, "stream": stream }

def run_ollama_prompt(prompt: str) -> dict:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt))
    r.raise_for_status()
    raw = (
        r.json()
        .get("response", "")
        .strip()
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    return json.loads(raw)

def minify_json(json_obj: dict) -> str:
    try:
        return json.dumps(json_obj, separators=(',', ':'))
    except Exception:
        return "" # in case the model returned JSON malformed

### AI Graph Helper Functions ~~~~~~~~~

def extract_json_object(text):
    depth = 0
    start = None

    for i, char in enumerate(text):
        if char == "{":
            if start is None:
                start = i
            depth += 1

        elif char == "}":
            depth -= 1

            if depth == 0 and start is not None:
                raw = text[start:i + 1]

                try:
                    return json.loads(raw), text[i + 1:]
                except json.JSONDecodeError:
                    pass
    return None, text

## OLLAMA PROMPTERS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

def create_payload(prompt: str, stream: bool):
    return { "model": ACTIVE_MODEL, "prompt": prompt, "stream": stream, "options": { "temperature": 0, "num_gpu": OLLAMA_NUM_GPU } }

def run_ollama_prompt(prompt: str, is_json=True) -> dict:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt, stream=False))
    r.raise_for_status()
    raw = (
        r.json()
        .get("response", "")
        .strip()
        .replace("```json", "")
        .replace("```", "")
        .strip()
    )

    return json.loads(raw) if is_json else raw

def open_ollama_stream(prompt: str) -> requests.Response:
    r = requests.post(OLLAMA_URL, json=create_payload(prompt, stream=True), stream=True)
    r.raise_for_status()
    return r

def iter_graph_objects(prompt):
    response = open_ollama_stream(prompt)
    buffer = ""

    for line in response.iter_lines():
        if not line: continue

        chunk = json.loads(line)
        if "response" not in chunk: continue

        buffer += chunk["response"]

        while True:
            obj, remaining = extract_json_object(buffer)
            if obj is None: break
            yield obj
            buffer = remaining

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

### AI Generate Graph JSON ~~~~~~~~~

def ai_generate_graph(text: str):
     node_prompt = f"""
     You are preparing a knowledge graph from a provided Source Text. You are required to extract the nodes of the graph, and provide a label.

     Your output must ONLY be the following json:
     {{"id":str, "label": str}}

     Produce your output in the same order in which the nodes appear from the text.

     EXAMPLE 1
     Source Text: "Stars form inside massive clouds of dust and gas called nebulas. Gravity pulls this material closely together, causing pressure and temperature to rise in the core. When the core gets hot enough, nuclear fusion triggers, allowing a bright new star to ignite. Without enough mass, the process fails, and a weak brown dwarf forms instead."
     Output: {{"id": "stars", "label": "stars"}},{{"id": "clouds", "label": "clouds"}},{{"id": "dust-gas", "label": "dust and gas"}},{{"id": "gravity", "label": "gravity"}},{{"id": "pressure", "label": "pressure"}},{{"id": "temperature", "label": "temperature"}},{{"id": "core", "label": "core"}},{{"id": "nuclear fusion", "label": "nuclear fusion"}},{{"id": "new star", "label": "new star"}},{{"id": "mass", "label": "mass"}},{{"id": "brown dwarf star", "label": "brown dwarf star"}}

     EXAMPLE 2
     Source Text: "Brains process new information by forming temporary neural connections during the day. Sleep stabilizes these fragile links, allowing short-term memories to move into permanent storage. When sleep is disrupted, this critical consolidation process fails, making it difficult to recall facts. Without enough rest, people struggle to retain new knowledge and focus."
     Output: {{"id": "brains", "label": "brains"}},{{"id": "new information", "label": "new information"}},{{"id": "temporary neural connections", "label": "temporary neural connections"}},{{"id": "sleep", "label": "sleep"}},{{"id": "short-term memories", "label": "short-term memories"}},{{"id": "permanent storage", "label": "permanent storage"}},{{"id": "consolidation process", "label": "consolidation process"}},{{"id": "facts", "label": "facts"}},{{"id": "rest", "label": "rest"}},{{"id": "people", "label": "people"}},{{"id": "new knowledge", "label": "new knowledge"}},{{"id": "focus", "label": "focus"}}

     EXAMPLE 3
     Source Text: "Firewalls block unauthorized data from entering private computer networks. Artificial intelligence monitors this incoming traffic, allowing systems to catch hidden digital threats instantly. When a cyberattack occurs, security protocols isolate the infected files to stop the spread. Without regular updates, systems become vulnerable and struggle to defend against new viruses."
     Output: {{"id": "firewalls", "label": "firewalls"}},{{"id": "unauthorized data", "label": "unauthorized data"}},{{"id": "private computer networks", "label": "private computer networks"}},{{"id": "artificial intelligence", "label": "artificial intelligence"}},{{"id": "incoming traffic", "label": "incoming traffic"}},{{"id": "systems", "label": "systems"}},{{"id": "hidden digital threats", "label": "hidden digital threats"}},{{"id": "cyberattack", "label": "cyberattack"}},{{"id": "security protocols", "label": "security protocols"}},{{"id": "infected files", "label": "infected files"}},{{"id": "regular updates", "label": "regular updates"}},{{"id": "new viruses", "label": "new viruses"}}

     EXAMPLE 4
     Source Text: "Wolves hunt in highly organized packs to bring down large prey. Alpha leaders coordinate the chase, allowing the group to surround targets without being spotted. When a target is isolated, the younger wolves move in to complete the hunt. Without a clear social hierarchy, the pack becomes chaotic and struggles to secure food."
     Output: {{"id": "wolves", "label": "wolves"}},{{"id": "organized packs", "label": "organized packs"}},{{"id": "large prey", "label": "large prey"}},{{"id": "alpha leaders", "label": "alpha leaders"}},{{"id": "chase", "label": "chase"}},{{"id": "group", "label": "group"}},{{"id": "targets", "label": "targets"}},{{"id": "younger wolves", "label": "younger wolves"}},{{"id": "hunt", "label": "hunt"}},{{"id": "social hierarchy", "label": "social hierarchy"}},{{"id": "pack", "label": "pack"}},{{"id": "food", "label": "food"}}

     Your Source Text from which to extract Nodes:
     {text}
     """
     nodes = []
     for n in iter_graph_objects(node_prompt):
         nodes.append(n)
         yield {"type": "node", "data": n}

     edge_prompt = f"""
     You are preparing a knowledge graph from a provided Source Text and a given list of Nodes. You are required to extract the edges of the graph, providing a source node, target, node, and their relationship ("label").

     Your output must ONLY be the following json:
     {{"id":str, "source":str, "target": str, "label": str}}

     RULES
     1. The Source Text is your Ground Truth Reference materials; the Node List are the concepts from the Source Text between which relationships should exist.
     2. Do NOT invent or force relationships that are not explicitly presented by the Source Text.
     3. Do NOT invent new Nodes: The Node List is IMMUTABLE.
     4. If a Node from the Node List doesn't have an explicit verb which relates it with another Node List item, leave it; Do NOT force a connection when one doesn't exist.
     5. The edge "id" field is simply the "source" and "target" conjoined with a '-' hyphen character.
     6. The edge "source" and "target" fields must be derived verbatim from the Nodes List.
     7. The edge "relation" must be derived from the Source Text ONLY; if a long phrase is used in the Text as the relationship (label), shorten it to within 1-3 words (by dropping terms like "the", "its", pronouns, etc)

     Produce your output in the order in which nodes appear in the Nodes List, seeking for their contextual references in the Source Text.

     Suggested Workflow:
     1. Retrieve node list item i.
     2. Look in the Source Text for verbs connecting node[i] with other nodes from the Node List.
     3. From the Source Text: if node[i] has a verb or connection to another concept which is EXCLUDED from the Node List, LEAVE IT and move to the next connecting item in the Source Text.
     4. From the Source Text: if node[i] has a verb or connection to another concept which is INCLUDED from the Node List, OUTPUT that edge connection, and move to the next connecting item in the Source Text.
     5. Continue process for each item in the Node List.

     EXAMPLE 1
     Source Text: "Stars form inside massive clouds of dust and gas called nebulas. Gravity pulls this material closely together, causing pressure and temperature to rise in the core. When the core gets hot enough, nuclear fusion triggers, allowing a bright new star to ignite. Without enough mass, the process fails, and a weak brown dwarf forms instead."
     Node List: [{{"id": "stars", "label": "stars"}},{{"id": "clouds", "label": "clouds"}},{{"id": "dust-gas", "label": "dust and gas"}},{{"id": "gravity", "label": "gravity"}},{{"id": "pressure", "label": "pressure"}},{{"id": "temperature", "label": "temperature"}},{{"id": "core", "label": "core"}},{{"id": "nuclear fusion", "label": "nuclear fusion"}},{{"id": "new star", "label": "new star"}},{{"id": "mass", "label": "mass"}},{{"id": "brown dwarf star", "label": "brown dwarf star"}}]
     Output: {{"id":"clouds-stars", "source":"clouds", "target": "stars", "label": "form"}}, {{"id":"clouds-dust-gas", "source":"clouds", "target": "dust-gas", "label": "are nebulas of"}}, {{"id":"gravity-pressure", "source":"gravity", "target": "pressure", "label": "pulls material"}}, {{"id":"gravity-temperature", "source":"gravity", "target": "temperature", "label": "pulls material"}}, {{"id":"pressure-core", "source":"pressure", "target": "core", "label": "rise"}}, {{"id":"temperature-core", "source":"temperature", "target": "core", "label": "rise"}}, {{"id":"core-nuclear fusion", "source":"core", "target": "nuclear fusion", "label": "hot enough"}}, {{"id":"nuclear fusion-new star", "source":"nuclear fusion", "target": "new star", "label": "ignite"}}, {{"id":"mass-brown dwarf star", "source":"mass", "target": "brown dwarf star", "label": "without enough process fails"}}

     EXAMPLE 2
     Source Text: "Brains process new information by forming temporary neural connections during the day. Sleep stabilizes these fragile links, allowing short-term memories to move into permanent storage. When sleep is disrupted, this critical consolidation process fails, making it difficult to recall facts. Without enough rest, people struggle to retain new knowledge and focus."
     Node List: [{{"id": "brains", "label": "brains"}},{{"id": "new information", "label": "new information"}},{{"id": "temporary neural connections", "label": "temporary neural connections"}},{{"id": "sleep", "label": "sleep"}},{{"id": "short-term memories", "label": "short-term memories"}},{{"id": "permanent storage", "label": "permanent storage"}},{{"id": "consolidation process", "label": "consolidation process"}},{{"id": "facts", "label": "facts"}},{{"id": "rest", "label": "rest"}},{{"id": "people", "label": "people"}},{{"id": "new knowledge", "label": "new knowledge"}},{{"id": "focus", "label": "focus"}}]
     Output: {{"id":"brains-new information", "source":"brains", "target": "new information", "label": "process"}}, {{"id":"brains-temporary neural connections", "source":"brains", "target": "temporary neural connections", "label": "forming"}}, {{"id":"sleep-temporary neural connections", "source":"sleep", "target": "temporary neural connections", "label": "stabilizes"}}, {{"id":"sleep-short-term memories", "source":"sleep", "target": "short-term memories", "label": "stabilizes"}}, {{"id":"short-term memories-permanent storage", "source":"short-term memories", "target": "permanent storage", "label": "move into"}}, {{"id":"consolidation process-facts", "source":"consolidation process", "target": "facts", "label": "recall"}}, {{"id":"rest-new knowledge", "source":"rest", "target": "new knowledge", "label": "without enough struggle to retain"}}, {{"id":"rest-focus", "source":"rest", "target": "focus", "label": "without enough struggle to"}}

     EXAMPLE 3
     Source Text: "Firewalls block unauthorized data from entering private computer networks. Artificial intelligence monitors this incoming traffic, allowing systems to catch hidden digital threats instantly. When a cyberattack occurs, security protocols isolate the infected files to stop the spread. Without regular updates, systems become vulnerable and struggle to defend against new viruses."
     Node List: [{{"id": "firewalls", "label": "firewalls"}},{{"id": "unauthorized data", "label": "unauthorized data"}},{{"id": "private computer networks", "label": "private computer networks"}},{{"id": "artificial intelligence", "label": "artificial intelligence"}},{{"id": "incoming traffic", "label": "incoming traffic"}},{{"id": "systems", "label": "systems"}},{{"id": "hidden digital threats", "label": "hidden digital threats"}},{{"id": "cyberattack", "label": "cyberattack"}},{{"id": "security protocols", "label": "security protocols"}},{{"id": "infected files", "label": "infected files"}},{{"id": "regular updates", "label": "regular updates"}},{{"id": "new viruses", "label": "new viruses"}}]
     Output: {{"id":"firewalls-unauthorized data", "source":"firewalls", "target": "unauthorized data", "label": "block"}}, {{"id":"unauthorized data-private computer networks", "source":"unauthorized data", "target": "private computer networks", "label": "entering"}}, {{"id":"artificial intelligence-incoming traffic", "source":"artificial intelligence", "target": "incoming traffic", "label": "monitors"}}, {{"id":"systems-hidden digital threats", "source":"systems", "target": "hidden digital threats", "label": "catch"}}, {{"id":"cyberattack-security protocols", "source":"cyberattack", "target": "security protocols", "label": "triggers"}}, {{"id":"security protocols-infected files", "source":"security protocols", "target": "infected files", "label": "isolate"}}, {{"id":"regular updates-systems", "source":"regular updates", "target": "systems", "label": "without become vulnerable"}}, {{"id":"systems-new viruses", "source":"systems", "target": "new viruses", "label": "struggle to defend against"}}

     EXAMPLE 4
     Source Text: "Wolves hunt in highly organized packs to bring down large prey. Alpha leaders coordinate the chase, allowing the group to surround targets without being spotted. When a target is isolated, the younger wolves move in to complete the hunt. Without a clear social hierarchy, the pack becomes chaotic and struggles to secure food."
     Node List: [{{"id": "wolves", "label": "wolves"}},{{"id": "organized packs", "label": "organized packs"}},{{"id": "large prey", "label": "large prey"}},{{"id": "alpha leaders", "label": "alpha leaders"}},{{"id": "chase", "label": "chase"}},{{"id": "group", "label": "group"}},{{"id": "targets", "label": "targets"}},{{"id": "younger wolves", "label": "younger wolves"}},{{"id": "hunt", "label": "hunt"}},{{"id": "social hierarchy", "label": "social hierarchy"}},{{"id": "pack", "label": "pack"}},{{"id": "food", "label": "food"}}]
     Output: {{"id":"wolves-organized packs", "source":"wolves", "target": "organized packs", "label": "hunt in"}}, {{"id":"organized packs-large prey", "source":"organized packs", "target": "large prey", "label": "bring down"}}, {{"id":"alpha leaders-chase", "source":"alpha leaders", "target": "chase", "label": "coordinate"}}, {{"id":"group-targets", "source":"group", "target": "targets", "label": "surround"}}, {{"id":"younger wolves-hunt", "source":"younger wolves", "target": "hunt", "label": "move in to complete"}}, {{"id":"social hierarchy-pack", "source":"social hierarchy", "target": "pack", "label": "without becomes chaotic"}}, {{"id":"pack-food", "source":"pack", "target": "food", "label": "struggles to secure"}}

     Your Source Text:
     {text}

     Your Node List:
     {json.dumps(nodes)}
     """
     edges_count = 0
     for e in iter_graph_objects(edge_prompt):
         edges_count += 1
         yield {"type": "edge", "data": e}

     yield {"type": "done", "stats": {"nodes": len(nodes), "edges": edges_count}}

     return

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## AI Generate Summary Content ~~~~~

def ai_generate_summary(raw_data: str, graph_json: dict, user_summary: str) -> SummaryResponse:

    response: SummaryResponse = {
        "aiSummary": "",
        "userSummaryReview": "",
        "userScore": 0,
    }

    combined_summary_sources = "\n<<<"
    combined_summary_sources += "\n1. Raw Notes:\n" + raw_data

    if graph_json != {}:
        combined_summary_sources += "\n2. Optional Graph Data:\n" + minify_json(graph_json)

    combined_summary_sources += "\n>>>"

    developed_summary_prompt = (summary_generation_templates["provide_summary"] + combined_summary_sources)

    ai_summary_json = run_ollama_prompt(developed_summary_prompt)
    response["aiSummary"] = ai_summary_json.get("aiSummary", "")

    if user_summary.strip() == "": # return early
        return response

    # continue to prepare the user review and score
    combined_review_sources = "\n<<<"
    combined_review_sources += "\n1. Raw Notes:\n" + raw_data
    combined_review_sources += "\n2. User Summary:\n" + user_summary
    combined_review_sources += "\n>>>"

    developed_review_prompt = (summary_generation_templates["provide_user_summary"] + combined_review_sources)

    ai_user_review_json = run_ollama_prompt(developed_review_prompt)
    response["userScore"] = ai_user_review_json.get("userScore", 0)
    response["userSummaryReview"] = ai_user_review_json.get("userSummaryReview", "")

    return response

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

## AI Searching JSON Graph ~~~~~~~~~

def ai_search_graph(search_input: str, json_graph: dict) -> SearchGraphResult:
    wrapped = {
        "query": search_input,
        "graph": json_graph
    }

    json_str = minify_json(wrapped)

    developed_prompt = (graph_searching_template + json_str)

    search_result_json = run_ollama_prompt(developed_prompt)

    return {
        "node_id": int(search_result_json.get("node_id", -1)),
        "label": search_result_json.get("label", ""),
        "score": float(search_result_json.get("score", -1.0))
    }

### ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
