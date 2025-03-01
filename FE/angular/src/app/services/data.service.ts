import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { forkJoin, Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { MoviesInterFace } from '../movies-module/store/store.modal';
import { getMoviesFromAPI } from '../movies-module/store/store.action';

interface SearchResults {
  Response: string;
  Search: Movie[];
  totalResults: string;
}

interface Movie {
  imdbID: string;
  Poster: string;
  Title: string;
  Type: string;
  Year: string | number;
}

interface MovieDetails extends Movie {
  Actors: string;
  Director: string;
  Genre: string;
  Plot: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Writer: string;
}

export interface MovieComplete extends MovieDetails {
  Year: number;
}

export interface MovieData {
  Decades: number[];
  Search: MovieComplete[];
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private decades: number[] = [];
  private posterUrl = 'https://m.media-amazon.com/images/M/';
  private serviceUrl = 'https://www.omdbapi.com/?apikey=f59b2e4b&';
  private storedMovies: MovieData = { Search: [], Decades: [] };

  constructor(private http: HttpClient, private store: Store<MoviesInterFace>) {}

  public getFilteredMovies(movies: MovieComplete[], decade?: number): MovieComplete[] {
    if (!decade) {
      return movies;
    }

    const decadeLimit = decade + 10;
    return movies.filter((movie) => movie.Year >= decade && movie.Year < decadeLimit);
  }

  public getMovie(id: string): Observable<MovieComplete> {
    return this.http.get<MovieDetails>(`${this.serviceUrl}i=${id}`).pipe(
      map(({ Actors, Director, Genre, imdbID, Plot, Poster, Rated, Released, Runtime, Title, Type, Writer, Year }) => ({
        Actors,
        Director,
        Genre,
        imdbID,
        Plot,
        Poster: Poster.replace(this.posterUrl, ''),
        Rated,
        Released,
        Runtime,
        Title,
        Type,
        Writer,
        Year: parseInt(Year as string)
      }))
    );
  }

  public getMovies(): Observable<MovieData> {
    if (this.storedMovies && this.storedMovies.Search.length) {
      return of(this.storedMovies);
    }

    return this.http.get<SearchResults>(`${this.serviceUrl}s=Batman&type=movie`).pipe(
      mergeMap(({ Search }) =>
        forkJoin(
          Search.map(({ imdbID, Year }) => {
            // add decade to decades
            const decade = Math.ceil(parseInt(Year as string) / 10) * 10 - 10;
            if (this.decades.indexOf(decade) < 0) {
              this.decades.push(decade);
            }

            return this.getMovie(imdbID);
          })
        )
      ),
      map((Search) => {
        Search = Search.sort(({ Year: year1 }: MovieComplete, { Year: year2 }: MovieComplete) => year1 - year2);
        this.decades.sort((a, b) => a - b);
        this.storedMovies = { Search, Decades: this.decades };
        return this.storedMovies;
      })
    );
  }
  // Storing movies locally,
  public setMovies(movies: MovieComplete[], decades: number[]) {
    this.storedMovies = {
      Search: movies,
      Decades: decades
    };
    localStorage.setItem('storedMovies', JSON.stringify(this.storedMovies));
  }
  // check if API response is stored locally inside storedMovies variable
  public hasMovies() {
    const storedItemsStr: string = localStorage.getItem('storedMovies') as string;
    this.storedMovies = JSON.parse(storedItemsStr) as MovieData;
    return this.storedMovies?.Search.length > 0;
  }

  // Dispatch store action for fetching data from apis
  public loadMoviesDataToStore() {
    this.store.dispatch(getMoviesFromAPI());
  }
}
