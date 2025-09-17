export const widgetDefs = [
  // TEXT → summary
  {
    id: "w_summary_text",
    kind: "text",
    title: "Write a short summary",
    target: { area: "summary" }
  },
  // SELECT → education degree
  {
    id: "w_degree_select",
    kind: "select",
    title: "Pick your degree",
    options: ["B.S. Computer Science", "B.A. Mathematics", "M.S. Data Science"],
    target: {
      area: "section",
      sectionId: "sec_education",
      itemId: "itm_edu_1",
      field: "degree"
    }
  },
  // MULTISELECT (+ add) → skills
  {
    id: "w_skills_ms",
    kind: "multiselect",
    title: "Select your skills (add your own too)",
    options: ["Python", "FastAPI", "TypeScript", "React"],
    allowAdd: true,
    target: { area: "skills", list: "skills" }
  },
  // FORM → contact email/phone
  {
    id: "w_contact_form",
    kind: "form",
    title: "Contact details",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        target: { area: "contact", field: "email" }
      },
      {
        name: "phone",
        label: "Phone",
        type: "tel",
        target: { area: "contact", field: "phone" }
      }
    ]
  },
  // LIST → contact links
  {
    id: "w_links_list",
    kind: "list",
    title: "Add your links",
    itemShape: [
      { name: "label", label: "Link name", type: "text" },
      { name: "url", label: "URL", type: "url" }
    ],
    target: { area: "contact", list: "links" },
    addLabel: "Add link"
  },
  // LIST → bullets for experience item
  {
    id: "w_exp_bullets",
    kind: "list",
    title: "Bullets for your Acme role",
    itemShape: [{ name: "bullet", label: "Bullet", type: "text" }],
    target: {
      area: "section",
      sectionId: "sec_experience",
      itemId: "itm_exp_1",
      list: "bullets"
    },
    addLabel: "Add bullet"
  },
  // FORM (mini) → edit job title/company
  {
    id: "w_job_mini_form",
    kind: "form",
    title: "Edit job basics (human-only)",
    fields: [
      {
        name: "title",
        label: "Title",
        type: "text",
        target: {
          area: "section",
          sectionId: "sec_experience",
          itemId: "itm_exp_1",
          field: "title"
        }
      },
      {
        name: "company",
        label: "Company",
        type: "text",
        target: {
          area: "section",
          sectionId: "sec_experience",
          itemId: "itm_exp_1",
          field: "company"
        }
      }
    ]
  }
];

// Toy flow: which widgets each bot step shows
export const botFlow = [
  { id: "b1", text: "Let's set contact details and a link.", widgets: ["w_contact_form", "w_links_list"] },
  { id: "b2", text: "Pick your degree.", widgets: ["w_degree_select"] },
  { id: "b3", text: "Select skills (and add your own).", widgets: ["w_skills_ms"] },
  { id: "b4", text: "Add bullets for your Acme role.", widgets: ["w_exp_bullets"] },
  { id: "b5", text: "Optionally adjust job title/company.", widgets: ["w_job_mini_form"] },
  { id: "b6", text: "Write a short summary.", widgets: ["w_summary_text"] }
];
