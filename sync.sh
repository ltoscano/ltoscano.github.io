cp -r ./_site/* ../ltoscano.github.io/
cd ..
cd ltoscano.github.io
grep -rli 'http:\/\/localhost:4000' * | xargs gsed -i 's/http:\/\/localhost:4000/https:\/\/ltoscano.github.com/g' 
