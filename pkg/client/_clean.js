import fs from 'fs';

export const clean = () => {
    fs.rm("./dist", {recursive: true}, (err) => {console.error(err)});
}

clean();