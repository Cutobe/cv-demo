const fs = require('fs');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const ImageModule = require('docxtemplater-image-module-free');
const yaml = require('js-yaml');
const path = require('path');
const sharp = require('sharp');

function toYaml(file) {
    const fileContents = fs.readFileSync(file, 'utf8');
    return yaml.load(fileContents);
}

async function createCircularImage(inputPath, outputPath, size) {
  const diameter = size * 2;

  const mask = Buffer.from(
    `<svg width="${diameter}" height="${diameter}">
      <circle cx="${size}" cy="${size}" r="${size}" fill="white" />
    </svg>`
  );

  await sharp(inputPath)
    .resize(diameter, diameter, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ transparency: true })
    .toFile(outputPath);
}

function projectSizeInMm(project) {
    const headerAndSubHeaderSize = 17;
    const technologiesSize = 12;
    const lineSize = 4.5;
    const averageCharactersPerLine = 85;

    const totalLinesSize = project.description.split('\n')
        .map(line => Math.ceil(line.length / averageCharactersPerLine))
        .map(numberOfLines => (numberOfLines + 1) * lineSize) // +1 => break after last word in paragraåh
        .reduce((a,b) => a+b, 0);

    const totalTechnologiesSize = technologiesSize + (project.techstack.length >= averageCharactersPerLine ? lineSize : 0);
    return headerAndSubHeaderSize + totalLinesSize + totalTechnologiesSize;
}

function pageify(projects) {
    let currentHeight = 30; // First page has a title
    const startHeightPage2Onwards = 15;
    const maxHeight = 260;
    for (let i = 0; i<projects.length; i++) {
        let pSize = projectSizeInMm(projects[i])* 0.9;
        console.log(pSize);
        currentHeight += pSize;
        console.log("current "+currentHeight);
        if (currentHeight > maxHeight) {
            projects[i-1].pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
            console.log("----");
            currentHeight = startHeightPage2Onwards + pSize;

        console.log("current "+currentHeight);
        } else {
            projects[i].pageBreak = '<w:br/>';
        }
    }
    return projects;
}

const PROFILE_PICTURE_SIZE = 182;

(async () => {
    const profilePictureSource = path.resolve(__dirname, '../src/assets/images/avatar.jpg');
    const profilePicturePath = path.resolve(__dirname, 'avatar-round.png');

    if (!fs.existsSync(profilePicturePath)) {
        await createCircularImage(profilePictureSource, profilePicturePath, PROFILE_PICTURE_SIZE);
    }

    const content = fs.readFileSync('template.docx', 'binary');
    const zip = new PizZip(content);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true, // Enable paragraph loops for repeating sections
        linebreaks: true,    // Support line breaks in placeholders
        modules: [new ImageModule({
            getImage(tagValue, tagName, meta) {
                return fs.readFileSync(tagValue);
            },
            getSize(img) {
                return [PROFILE_PICTURE_SIZE, PROFILE_PICTURE_SIZE];
            },
        })],
    });

    const cvData = toYaml('_data/data.yml');
    const titles = cvData.static;

    doc.render({
        skillsTitle: titles.skills,
        employmentTitle: titles.employments,
        educationTitle: titles.education,
        contactTitle: titles.contact,
        technologiesTitle: titles.technologies,
        projectsTitle: titles.projects,

        profilePicture: profilePicturePath,
        firstName: cvData.personal_info.first_name,
        lastName: cvData.personal_info.last_name,
        profession: cvData.personal_info.profession,
        introduction: cvData.personal_info.introduction,

        degrees: [...cvData.education.degrees].map(deg => ({...deg, 'title': deg.title.replace('<br/>', '').replace('<br>', '').replace('<br />', '')})),

        skills: [...cvData.skills.list].map(v => ({'name': v})),

        contactInfo: [...cvData.contact_info.list],

        employments: [...cvData.employments.list],

        projects: pageify([...cvData.projects.list]),
    });

    const buffer = doc.getZip().generate({ type: 'nodebuffer' });

    fs.writeFileSync('cv.docx', buffer);

    console.log('Document generated successfully: cv.docx');
})();
