export function seedResume() {
  return {
    resume: {
      contact: {
        firstName: "Ava",
        lastName: "Nguyen",
        email: "",
        phone: "",
        links: []
      },
      summary: "",
      skills: [],
      sections: [
        {
          id: "sec_experience",
          name: "Experience",
          fields: ["title", "company", "location", "dates"],
          items: [
            {
              id: "itm_exp_1",
              fields: {
                title: "Senior Engineer",
                company: "Acme",
                location: "Denver, CO",
                dates: "2022–Present"
              },
              bullets: []
            }
          ]
        },
        {
          id: "sec_education",
          name: "Education",
          fields: ["school", "degree", "location", "date"],
          items: [
            {
              id: "itm_edu_1",
              fields: {
                school: "University of Somewhere",
                degree: "",
                location: "Somewhere, USA",
                date: "2020"
              },
              bullets: []
            }
          ]
        }
      ],
      meta: { format: "resume-v2", version: 2, locale: "en-US" }
    }
  };
}
