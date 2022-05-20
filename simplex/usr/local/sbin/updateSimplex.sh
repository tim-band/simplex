sudo -Hu wwwrunner Rscript -e "remotes::install_github(repo=c('tim-band/shinylight','pvermees/simplex'),force=TRUE,lib='~/R')"
sudo /usr/local/sbin/simplexctl restart
