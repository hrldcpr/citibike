CURRENT="temp-current"
NEXT="temp-next"

rm -f $CURRENT
touch $CURRENT

for f in $1/*.gz
do
    zcat $f > $NEXT
    DIFF=$(diff -q $CURRENT $NEXT)
    if [ "$DIFF" == "" ]
    then
        echo "rm $f"
        rm $f
    fi
    mv $NEXT $CURRENT
done

rm $CURRENT
