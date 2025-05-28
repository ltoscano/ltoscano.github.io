#!/bin/bash

# Script per aggiornare note/file nel repository
# Uso: ./update_notes.sh <nome_file> [messaggio_commit_opzionale]

# Funzione per mostrare l'uso corretto
show_usage() {
    echo "📝 Script per aggiornare file nel repository"
    echo "============================================"
    echo ""
    echo "Uso:"
    echo "  ./scripts/update_notes.sh <nome_file> [messaggio_commit]"
    echo ""
    echo "Esempi:"
    echo "  ./scripts/update_notes.sh README.md"
    echo "  ./scripts/update_notes.sh privacy/index.html \"Aggiornamento privacy policy\""
    echo "  ./scripts/update_notes.sh \"data/feeds/*.json\" \"Aggiornamento feed RSS\""
    echo ""
    echo "Il file può essere:"
    echo "  - Un percorso relativo (es: README.md, data/feeds/medium.json)"
    echo "  - Un percorso assoluto (es: /path/to/file.txt)"
    echo "  - Un pattern glob (es: \"data/feeds/*.json\")"
}

# Verifica parametri
if [ $# -eq 0 ]; then
    echo "❌ Errore: Nessun file specificato"
    echo ""
    show_usage
    exit 1
fi

FILE_PATTERN="$1"
COMMIT_MESSAGE="$2"

# Verifica se siamo in una directory git
if [ ! -d ".git" ]; then
    echo "❌ Errore: Non sei in una directory git"
    echo "💡 Assicurati di eseguire lo script dalla root del repository"
    exit 1
fi

# Verifica se il file/pattern esiste
if [[ "$FILE_PATTERN" == *"*"* ]]; then
    # È un pattern glob
    echo "🔍 Verificando pattern: $FILE_PATTERN"
    if ! ls $FILE_PATTERN >/dev/null 2>&1; then
        echo "❌ Errore: Nessun file trovato per il pattern '$FILE_PATTERN'"
        exit 1
    fi
else
    # È un file specifico
    if [ ! -e "$FILE_PATTERN" ]; then
        echo "❌ Errore: Il file '$FILE_PATTERN' non esiste"
        exit 1
    fi
fi

# Mostra lo stato corrente del file
echo "📊 Stato attuale del repository:"
git status --porcelain "$FILE_PATTERN" 2>/dev/null || echo "   Nessuna modifica rilevata per il pattern specificato"
echo ""

# Aggiungi file al staging
echo "📦 Aggiungendo file al staging..."
git add "$FILE_PATTERN"

if [ $? -ne 0 ]; then
    echo "❌ Errore durante l'aggiunta del file al staging"
    exit 1
fi

# Verifica se ci sono modifiche nel staging
if git diff --staged --quiet; then
    echo "ℹ️  Nessuna modifica da committare per '$FILE_PATTERN'"
    echo "   Il file potrebbe essere già aggiornato nel repository"
    exit 0
fi

# Genera messaggio di commit automatico se non fornito
if [ -z "$COMMIT_MESSAGE" ]; then
    FILENAME=$(basename "$FILE_PATTERN")
    CURRENT_DATE=$(date '+%d/%m/%Y %H:%M')
    
    if [[ "$FILE_PATTERN" == *"privacy"* ]]; then
        COMMIT_MESSAGE="Aggiornamento Privacy Policy - $CURRENT_DATE"
    elif [[ "$FILE_PATTERN" == *"README"* ]]; then
        COMMIT_MESSAGE="Aggiornamento documentazione - $CURRENT_DATE"
    elif [[ "$FILE_PATTERN" == *"feed"* ]]; then
        COMMIT_MESSAGE="Aggiornamento feed RSS - $CURRENT_DATE"
    elif [[ "$FILE_PATTERN" == *".md"* ]]; then
        COMMIT_MESSAGE="Aggiornamento note: $FILENAME - $CURRENT_DATE"
    elif [[ "$FILE_PATTERN" == *".json"* ]]; then
        COMMIT_MESSAGE="Aggiornamento dati: $FILENAME - $CURRENT_DATE"
    else
        COMMIT_MESSAGE="Aggiornamento: $FILENAME - $CURRENT_DATE"
    fi
fi

# Mostra i file che verranno committati
echo "📋 File che verranno committati:"
git diff --staged --name-only
echo ""

# Commit
echo "💾 Committando modifiche..."
echo "📝 Messaggio: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"

if [ $? -ne 0 ]; then
    echo "❌ Errore durante il commit"
    exit 1
fi

echo "✅ Commit completato!"

# Push
echo "🚀 Pushing al repository remoto..."
git push

if [ $? -eq 0 ]; then
    echo "✅ Push completato con successo!"
    echo ""
    echo "🎉 File '$FILE_PATTERN' aggiornato nel repository!"
    echo "📊 Stato finale:"
    git log --oneline -1
else
    echo "❌ Errore durante il push"
    echo "💡 Puoi provare a fare il push manualmente con: git push"
    exit 1
fi
